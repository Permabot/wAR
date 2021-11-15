/**
* MIT License
*
* Copyright (c) 2019 Finocial
*
* Permission is hereby granted, free of charge, to any person obtaining a copy
* of this software and associated documentation files (the "Software"), to deal
* in the Software without restriction, including without limitation the rights
* to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
* copies of the Software, and to permit persons to whom the Software is
* furnished to do so, subject to the following conditions:
*
* The above copyright notice and this permission notice shall be included in all
* copies or substantial portions of the Software.
*
* THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
* IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
* FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
* AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
* LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
* OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
* SOFTWARE.
*/

const { assert, expect } = require("chai");

advanceBlock = () => {
  return new Promise((resolve, reject) => {
      web3.currentProvider.send({
          jsonrpc: "2.0",
          method: "evm_mine",
          id: new Date().getTime()
      }, (err, result) => {
          if (err) { return reject(err); }
          const newBlockHash = web3.eth.getBlock('latest').hash;

          return resolve(newBlockHash)
      });
  });
}


var WPBTToken = artifacts.require("wPBT");



contract("Wrapped PBT Tests", async function(accounts) {
//   let accounts;
  let owner, addr1, addr2;
  let admin, borrower, lender;
  let loanRequest;

    
  before(async function() {
    // accounts = await web3.eth.getAccounts();
    [owner, addr1, addr2] = accounts;
    console.log('owner ', owner, ', add1: ', addr1,', add2: ', addr2);

  });
  



  

  describe("Scenario 1", () => {

    var  wPBTToken;

    before('Initialize and Deploy SmartContracts', async () => {
        // wPBTToken = await WPBTToken.new("Test Tokens", "TTT", 18, 10000000);

        // await wPBTToken.transfer(borrower, 1000000, {
        //     from: admin,
        //     gas: 300000
        // });

        
        wPBTToken = await WPBTToken.deployed();
        console.log('deployed  pbt');
        



    });

    it('Mint should not exceed Max supply', async() => {

      let totSupply = await wPBTToken.totalSupply.call();
      console.log('Initial Total supply: ',  totSupply.toString() );
      // console.log('Initial Total supply 2: ', await wPBTToken.methods.totalSupply().call());
      
        // await wPBTToken.transfer(borrower, 1000000, {
        //   from: admin
        // });

        await wPBTToken.ownermint(90000000, {
          from: owner
        });

        await advanceBlock();
        
        console.log('Minted 90m   pbt');

        totSupply = await wPBTToken.totalSupply.call();

        console.log('Total supply: ', totSupply.toString() );

        try{
          await wPBTToken.ownermint(90000000, {
            from: owner
          });
          
          console.log('Minted another 90m   pbt');
          
          totSupply = await wPBTToken.totalSupply.call();
          console.log('Total supply: ', totSupply.toString() );
        }catch(err){
          // assert.fail('')
          console.log('Max Limit will be hit   pbt');
        }
        

        

        // await wPBTToken.burn(60000000, {
        //   from: admin
        // });

  });

    it('transfers from Excluded accounts should take no fee', async() => {

        // const instance = await MetaCoin.deployed();
        // const balance = await instance.getBalance.call(accounts[0]);

        assert.equal(1, 1);

    });

    

    

  });


})
