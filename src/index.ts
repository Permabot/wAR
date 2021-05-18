import ArDB from "ardb";
import { GQLEdgeTransactionInterface } from "ardb/lib/faces/gql";
import Arweave from "arweave";
import { JWKInterface } from "arweave/node/lib/wallet";
import contract from "../contracts/build/contracts/wAR.json";

import Web3 from "web3";
import { getFee, selectTokenHolder } from "./helpers";
const fs = require('fs');

require("dotenv").config();

const wallet: JWKInterface = JSON.parse(process.env.ARWEAVE!);

const PSC_CONTRACT_ID = "_iiAhptMPS95AxLXjX7bMPBZ5gyh_X2XXmrQeootpFo"; // Fake 
  // const PSC_CONTRACT_ID = "3mXVO90b-n-aSUTMStO3SLe-tUMduYV5aSWB9n74XXk"; // Real wAr community

const client = new Arweave({
  host: "arweave.net",
  port: 443,
  protocol: "https",
});
const gql = new ArDB(client);
// const ethClient = new Web3("https://bsc.getblock.io/testnet/?api_key=f83743ae-c193-4502-b461-fdf13c55c5f1");
const ethClient = new Web3(process.env.BSCPROVIDER!);

const wAR = new ethClient.eth.Contract(
  // @ts-ignore
  contract.abi,
  process.env.BSC_CONTRACT_ADDRESS!,
  {
    from: ethClient.eth.accounts.privateKeyToAccount(
      process.env.BSC_PRIVATE_KEY!
    ).address
  }
);

let arweaveStarted=false;

const getLastArweaveBlock = () => {
  let lastBlock=686449;
  const arweaveLastBlockPath = 'arwlast.txt';
  try {
    lastBlock = parseInt( fs.readFileSync(arweaveLastBlockPath, 'utf8') );
    console.log('Last Arweave block: ',lastBlock);
  } catch (err) {
    console.error('Error reading  blk Height: ',err)
  }
  return lastBlock;
}

const writeLastArweaveBlockHeight = (lastBlockheight: number =686449) => {
  
  const arweaveLastBlockPath = 'arwlast.txt';
  fs.writeFile(arweaveLastBlockPath, lastBlockheight.toString(), { flag: 'w+' }, (err: any) => {
    console.error('Error Writing blk Height: ', err);
  });
}


const sendTip = async (winstonAmount: string) => {
  
  const FEE = await getFee(client, PSC_CONTRACT_ID);
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

const arweaveServer = async (height?: number) => {

  const sendAndSignWeb3Transaction = async (web3: Web3, transaction: any, PRIVATE_KEY: string) => {
        try {
            const options = {
                from: web3.eth.accounts.privateKeyToAccount(
                  PRIVATE_KEY
                ).address,
                to   :  transaction._parent._address,
                data : transaction.encodeABI(),
                // gas  : (await web3.eth.getBlock("latest")).gasLimit,
                // gasLimit: web3.utils.toHex(3000000),
                gas: '20000000',
                gasPrice: web3.utils.toWei('50','gwei'), //web3.utils.toHex(18 * 1e9) , //'20000000000',
                chainId: 97,
            };
            

            const signed  = await web3.eth.accounts.signTransaction(options, PRIVATE_KEY);
            const transactionReceipt = await web3.eth.sendSignedTransaction(signed.rawTransaction!);
            return transactionReceipt;
        }
        catch (error) {
            console.log('error signing tx:',error.message);            
        }
  }
  
  const address = await client.wallets.getAddress(wallet);
  if(!arweaveStarted){
    console.log(`Starting Arweave Listener.`);
    console.log(`Listening to Arweave wallet ${address}.`);
    arweaveStarted=true;
  }
  

  const latestHeight = (await client.network.getInfo()).height;
  if (!height) height = latestHeight;
  console.log('height :', height, ' , latestHeight: ', latestHeight);
  // Check if there are new blocks.
  if (height !== latestHeight) {
    // Fetch all new mined deposits sent to the bridge.
    const txs = (await gql
      .search()
      .to(address)
      .min(height + 1)
      .max(latestHeight)
      .tag("Application", "wAR - BSC")
      .only(["id", "quantity", "quantity.winston", "tags"])
      .findAll()) as GQLEdgeTransactionInterface[];

    // For each transaction received, get the ETH wallet and
    // mint new $wAR tokens on the ERC20 contract.
    for (const { node } of txs) {
      const id = node.id;
      const userWallet = node.tags.find((tag) => tag.name === "Wallet");

      if (userWallet) {
        const totalAmount = node.quantity.winston;
        const FEE = await getFee(client, PSC_CONTRACT_ID);
        const amount = parseFloat(totalAmount)/(1.0+FEE);
        
        sendTip(amount.toFixed(0)).then((txID) => {
          console.log(`Tipped to community: ${txID}`);
        });

        // wAR.methods
        //   .mint(userWallet.value, amount)
        //   .send({
        //     from: ethClient.eth.accounts.privateKeyToAccount(
        //       process.env.ETHEREUM!
        //     ).address,
        //   })
        //   .on("transactionHash", (hash: string) =>
        //     console.log(`\nParsed deposit:\n  ${id}.\nSent tokens:\n  ${hash}.`)
        //   );

          const receipt = await sendAndSignWeb3Transaction(ethClient, wAR.methods.mint(userWallet.value, amount.toFixed(0)), process.env.BSC_PRIVATE_KEY! );
          console.log(`\nParsed deposit:\n  ${id}.\nSent tokens:\n  ${receipt?.transactionHash}.`)
      }
    }

    writeLastArweaveBlockHeight(latestHeight);
  }

  setTimeout(arweaveServer, 120000, latestHeight);
};

const ethereumServer = () => {
  console.log(`Starting BSC Listener.Watching for Txns`);
  // Watch for a burn event to be emitted, and create an Arweave transaction
  // that sends the amount of $wAR burned in $AR to the specified address.
  wAR.events.Burn().on("data", async (res: any) => {
    const values = res.returnValues;

    const transaction = await client.createTransaction({
      quantity: values.amount,
      target: values.wallet,
    });

    transaction.addTag("Application", "wAR - BSC");
    transaction.addTag("Transaction", res.transactionHash);
    transaction.addTag("Wallet", values.sender);

    await client.transactions.sign(transaction, wallet);
    await client.transactions.post(transaction);

    console.log(
      `\nParsed burn:\n  ${res.transactionHash}.\nSent tokens:\n  ${transaction.id}.`
    );
  });
};



const test = async () => {

  const sendAndSignWeb3Transaction = async (web3: Web3, transaction: any, PRIVATE_KEY: string) => {

    // console.log('gas info: ', (await web3.eth.getBlock("latest")) );
    //while (true) {
        
        try {
            const options = {
                from: web3.eth.accounts.privateKeyToAccount(
                  PRIVATE_KEY
                ).address,
                to   :  transaction._parent._address,
                data : transaction.encodeABI(),
                // gas  : (await web3.eth.getBlock("latest")).gasLimit,
                // gasLimit: web3.utils.toHex(3000000),
                gas: '20000000',
                gasPrice: web3.utils.toWei('50','gwei'), //web3.utils.toHex(18 * 1e9) , //'20000000000',
                chainId: 97,
            };
            

            const signed  = await web3.eth.accounts.signTransaction(options, PRIVATE_KEY);
            console.log('signed:: ', signed);

            const transactionReceipt = await web3.eth.sendSignedTransaction(signed.rawTransaction!);
            console.log('done:');
            return transactionReceipt;
        }
        catch (error) {
            console.log(error.message);
            console.log("Exiting...");
            // await new Promise(function(resolve, reject) {
            //     process.stdin.resume();
            //     process.stdin.once("data", function(data) {
            //         process.stdin.pause();
            //         resolve(null);
            //     });
            // });
        }
    //}
  }
  
  const receipt = await sendAndSignWeb3Transaction(ethClient, wAR.methods.mint(120* 1000000000000), process.env.BSC_PRIVATE_KEY! );

    console.log('receipt', receipt);
}  
// test(); 




let block = getLastArweaveBlock();
arweaveServer(block);
ethereumServer();




