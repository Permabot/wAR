import ArDB from "ardb";
import { GQLEdgeTransactionInterface } from "ardb/lib/faces/gql";
import Arweave from "arweave";
import { JWKInterface } from "arweave/node/lib/wallet";
import wARBSCcontract from "../contracts/build/contracts/wAR.json";
import wPBTBSCcontract from "../contracts/build/contracts/wPBT.json";
import BigNumber from "bignumber.js";
import Web3 from "web3";
import {Contract, ContractOptions} from 'web3-eth-contract';
import { getARFeePercent,getPSTFeePercentage, selectTokenHolder, calculatePSTFeeCharged } from "./helpers";
import { readContract, interactWrite, interactWriteDryRun } from 'smartweave';
import { IPSTInfo } from "./models/IPstInfo";
const fs = require('fs');

require("dotenv").config();

const wallet: JWKInterface = JSON.parse(process.env.ARWEAVE!);

// const PSC_CONTRACT_ID = "_iiAhptMPS95AxLXjX7bMPBZ5gyh_X2XXmrQeootpFo"; // Fake 
const PSC_CONTRACT_ID = "3mXVO90b-n-aSUTMStO3SLe-tUMduYV5aSWB9n74XXk"; // Real wAr community

const client = new Arweave({
  host: "arweave.net",
  port: 443,
  protocol: "https",
});
const gql = new ArDB(client);

const ethClient = new Web3(process.env.BSCPROVIDER!);// wss://bsc.getblock.io/testnet/?api_key= 


const wAR = new ethClient.eth.Contract(
  // @ts-ignore
  wARBSCcontract.abi,
  process.env.BSC_CONTRACT_ADDRESS!,
  {
    from: ethClient.eth.accounts.privateKeyToAccount(
      process.env.BSC_PRIVATE_KEY!
    ).address
  }
);

const wPBT = new ethClient.eth.Contract(
    // @ts-ignore
    wPBTBSCcontract.abi,
    process.env.BSC_PBT_ADDRESS!,
    {
      from: ethClient.eth.accounts.privateKeyToAccount(
        process.env.BSC_PRIVATE_KEY!
      ).address
    }
);

const pstBEPContracts = new Map<string, Contract>();
pstBEPContracts.set("0GRLIbU0jmipa-jBuNjrshdBsrw96HTSVdCyLniF1Sg",wPBT);

const bscAccount = ethClient.eth.accounts.privateKeyToAccount(
  process.env.BSC_PRIVATE_KEY!
);

let arweaveStarted=false;

const arweaveLastBlockPath = 'arwlast.txt';
const getLastArweaveBlock = () => {
  let lastBlock=686449;  
  try {
    lastBlock = parseInt( fs.readFileSync(arweaveLastBlockPath, 'utf8') );
    console.log('Last Arweave block: ',lastBlock);
  } catch (err) {
    if(err){
      console.error('Error reading  blk Height: ',err)
    }
    
  }
  return lastBlock;
}

const writeLastArweaveBlockHeight = (lastBlockheight: number =686449) => {
  fs.writeFile(arweaveLastBlockPath, lastBlockheight.toString(), { flag: 'w+' }, (err: any) => {
    if(err){
      console.error('Error Writing blk Height: ', err);
    }
  });
}

const bscLastBlockPath = 'bsclast.txt';
const getLastSavedBSCBlock = () => {
  let lastBlock=0;
  
  try {
    lastBlock = parseInt( fs.readFileSync(bscLastBlockPath, 'utf8') );
    console.log('Last BSC block: ',lastBlock);
  } catch (err) {
    if(err){
      console.error('Error reading  BSC blk Height: ',err)
    }
    
  }
  return lastBlock;
}

const writeLastBSCBlock = (lastBlockheight: number =0) => {  
  fs.writeFile(bscLastBlockPath, lastBlockheight.toString(), { flag: 'w+' }, (err: any) => {
    if(err){
      console.error('Error Writing BSC blk Height: ', err);
    }
  });
}


const sendTip = async (winstonAmount: string) => {
  
  const FEE = await getARFeePercent(client, PSC_CONTRACT_ID);
  const target = await selectTokenHolder(client, PSC_CONTRACT_ID);

  const tipAmount = Math.floor(parseInt(winstonAmount) * FEE);

  const transaction = await client.createTransaction({
    quantity: tipAmount.toString(),
    target,
  });

  transaction.addTag("Application", "wAR - BSC");
  transaction.addTag("Action", "Community Fee");

  console.log(`Tipped Amount to community: ${tipAmount}`);

  await client.transactions.sign(transaction, wallet);
  await client.transactions.post(transaction);
  return transaction.id;
};


const sendPSTTip = async (WRAP_PSC_CONTRACT_ID: string, pstTipAmount: number ) => {
     
    const target = await selectTokenHolder(client, PSC_CONTRACT_ID);

    try{
        let tags = [
            {
              name:'Application', 
              value:'wAR - BSC'
            },
            {
              name:"Action", 
              value: "Community Fee"
            }
          ]

        const responseTxId = await interactWrite(client,wallet,WRAP_PSC_CONTRACT_ID,{ "function": "transfer", "qty": pstTipAmount, "target": target } ,tags, target );
        // console.log('responseTxId: ', responseTxId ); 
        return responseTxId;

      }catch(errr){
        console.error(errr);
        return null;
      }
};

const sendAndSignWeb3Transaction = async (web3: Web3, transaction: any, PRIVATE_KEY: string) => {
    try {
        let estimatedGas = await transaction.estimateGas({ from: bscAccount.address });
        console.log('estimatedgas: ', estimatedGas);
        const options = {
            from: bscAccount.address,
            to   :  transaction._parent._address,
            data : transaction.encodeABI(),
            
            // gas: '20000000',
            // gasPrice: web3.utils.toWei('50','gwei'), //web3.utils.toHex(18 * 1e9) , //'20000000000',
            gas: estimatedGas,
            chainId: 97,
        };
        
        console.log('options: ', options);


        const signed  = await web3.eth.accounts.signTransaction(options, PRIVATE_KEY);
        const transactionReceipt = await web3.eth.sendSignedTransaction(signed.rawTransaction!);
        return transactionReceipt;
    }
    catch (error) {
        console.log('error signing tx:',error); 
        console.log('error signing tx:',error.message);            
    }
}

const arweaveServer = async (height?: number) => {
  
  const address = await client.wallets.getAddress(wallet);
  if(!arweaveStarted){
    console.log(`Starting Arweave Listener.`);
    console.log(`Listening to Arweave wallet ${address}.`);
    arweaveStarted=true;
  }
  

  const latestHeight = (await client.network.getInfo()).height;
  if (!height) height = latestHeight;
  // console.log('height :', height, ' , latestHeight: ', latestHeight);
  // Check if there are new blocks.
  if (height < latestHeight) {
    // Fetch all new mined deposits sent to the bridge.
    const txs = (await gql
      .search()
      .to(address)
      .min(height + 1)
      .max(latestHeight)
      .tag("Application", "wAR - BSC")
      .tag("Action", "MINT")
      .tag("Coin", "AR")
      .only(["id", "quantity", "quantity.winston", "tags"])
      .findAll()) as GQLEdgeTransactionInterface[];

    // For each transaction received, get the ETH wallet and
    // mint new $wAR tokens on the ERC20 contract.
    for (const { node } of txs) {
      const id = node.id;
      const userWallet = node.tags.find((tag) => tag.name === "Wallet");

      if (userWallet) {
        
        const totalAmount = new BigNumber(node.quantity.winston);
        const FEE = new BigNumber(await getARFeePercent(client, PSC_CONTRACT_ID));
        const amount = totalAmount.dividedBy(FEE.plus(1) );  // parseFloat(totalAmount)/( 1.0 + FEE);
        // console.log('prs tot:', totalAmount.toFixed(),', fee: ',FEE.toString(),', amt:',amount, ', fix:',amount.toFixed());


        // sendTip(amount.toFixed()).then((txID) => {
        //   console.log(`Tipped to community: ${txID}`);
        // });

        const receipt = await sendAndSignWeb3Transaction(ethClient, wAR.methods.mint(userWallet.value, amount.toFixed(0)), process.env.BSC_PRIVATE_KEY! );
        console.log(`\nParsed Arweave deposit TxID:\n  ${id}.\nSent tokens Tx Hash:\n  ${receipt?.transactionHash}.`)
      }
    }
    
    await processPSTToBscTransactions(address, height, latestHeight);

    writeLastArweaveBlockHeight(latestHeight);
    
  }
  
  setTimeout(arweaveServer, 120000, latestHeight);
};






const processPSTToBscTransactions = async (receivingAddress: string, height: number,latestHeight: number) => {

  console.log(`Checking Arweave wallet ${receivingAddress} for PST Transactions.`);
  
  if (height < latestHeight) {
    // Fetch all new mined deposits sent to the bridge.
    const txs = (await gql
      .search('transactions')
      .to(receivingAddress)
      .min(height + 1)
      .max(latestHeight)
      .appName('SmartWeaveAction')
      .tag("Application", "wAR - BSC")
      .tag("Action", "MINT")
      .only(["id", "quantity", "quantity.winston", "tags"])
      .findAll()) as GQLEdgeTransactionInterface[];

    // For each transaction received, get the ETH wallet and
    // mint new $wAR tokens on the ERC20 contract.
    for (const { node } of txs) {
      const id = node.id;
      const userWallet = node.tags.find((tag) => tag.name === "Wallet");
      const pstToWrapContract = node.tags.find((tag) => tag.name === "Contract");
      const pstInfoTag = node.tags.find((tag) => tag.name === "Input");

      if (userWallet && pstToWrapContract && pstInfoTag) {
        
        const pstInfo = JSON.parse(pstInfoTag.value) as IPSTInfo;

        const totalAmount = pstInfo.qty;
        // Fee is 1% for orders greater than 100 - use ceiling price
        const PERCENTFEE = await getPSTFeePercentage(client, PSC_CONTRACT_ID);
        let FEE = calculatePSTFeeCharged(totalAmount, PERCENTFEE);
        const amount = totalAmount- FEE;         

        console.log('Total:', totalAmount.toFixed(),', fee: ',FEE.toString(),', Amt:',amount);

        console.log('pstToWrapContract.value:', pstToWrapContract.value);


        // sendPSTTip(pstToWrapContract.value, FEE).then((txID) => {
        //   console.log(`Tipped to community: ${txID}`);
        // });
        if(pstBEPContracts.has(pstToWrapContract.value)){
            const receipt = await sendAndSignWeb3Transaction(ethClient, pstBEPContracts.get(pstToWrapContract.value)?.methods.mint(userWallet.value, amount.toFixed(0)), process.env.BSC_PRIVATE_KEY! );
            console.log(`\nParsed Arweave deposit TxID:\n  ${id}.\nSent tokens Tx Hash:\n  ${receipt?.transactionHash}`)
        }
        
      }
    }
    
        
  }
};


let bscListenerStarted = false;

const bscServer = async (block?: number) => {
    if(!bscListenerStarted){
        console.log(`Starting BSC Listener.Watching for Txns`);
        bscListenerStarted=true;
    }
  

  const latestBlock = await ethClient.eth.getBlockNumber();
  if (!block) block = latestBlock;
  // console.log('BSC Block :', block, ' , latestBlock: ', latestBlock);

  if (block < latestBlock) {
    const events = await wAR.getPastEvents('Burn', {
      filter: {/*myIndexedParam: [20,23], myOtherIndexedParam: '0x123456789...'*/}, // Using an array means OR: e.g. 20 or 23
      fromBlock: block,
      toBlock: latestBlock
    });

    for (const { returnValues, transactionHash } of events) {
      const values = returnValues;
      // console.log('values: ', values, ', transactionHash:',transactionHash);
      const transaction = await client.createTransaction({
        quantity: values.amount,
        target: values.wallet,
      });

      transaction.addTag("Application", "wAR - BSC");
      transaction.addTag("Action", "BURN");
      transaction.addTag("Transaction", transactionHash);
      transaction.addTag("Wallet", values.sender);

      await client.transactions.sign(transaction, wallet);
      await client.transactions.post(transaction);

      console.log(
        `\nParsed burn:\n  ${transactionHash}.\nSent tokens:\n  ${transaction.id} `
      );
    }

    await bscPSTServer(block, latestBlock);
    
    writeLastBSCBlock(latestBlock);

  }
  

  setTimeout(bscServer, 30*1000, latestBlock);

};


const bscPSTServer = async ( block, latestBlock)=> {
    for( let [key, pstContract] of pstBEPContracts){
        const events = await pstContract.getPastEvents('Burn', {
            filter: {/*myIndexedParam: [20,23], myOtherIndexedParam: '0x123456789...'*/}, // Using an array means OR: e.g. 20 or 23
            fromBlock: block,
            toBlock: latestBlock
        });
      
        for (const { returnValues, transactionHash } of events) {
            const values = returnValues;
            const quantity= values.amount;
            const target =  values.wallet;
            try{
                let tags = [
                    {
                      name:'Application', 
                      value:'wAR - BSC'
                    },
                    {
                      name:"Action", 
                      value: "Burn"
                    },
                    {
                      name:"Transaction", 
                      value: transactionHash
                    },
                    {
                      name:"Wallet", 
                      value: values.sender
                    }
                  ];
                          
                const responseTxId = await interactWrite(client,wallet,key,{ "function": "transfer", "qty": +quantity, "target": target } ,tags, target );
                // console.log('responseTxId: ', responseTxId ); 
                console.log(
                    `\nParsed burn ${key}:\n  ${transactionHash}.\nSent tokens:\n  ${responseTxId} `
                );
                return responseTxId;
        
              }catch(errr){
                console.error(errr);
                return null;
              }

            
            
        }
    }
}




let arweaveBlock = getLastArweaveBlock();
arweaveServer(arweaveBlock);
// ethereumServer();

let bscBlock = getLastSavedBSCBlock();
bscServer(bscBlock);




