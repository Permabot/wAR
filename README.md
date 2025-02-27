<p align="center">
  <h3 align="center"><code>wⒶR</code></h3>
  <p align="center">Wrapped AR on Binance Smart Chain.</p>
</p>

## Overview

$wAR is a BEP-20 token that maps one-to-one to $AR.

This is enabled by a _custodian_, a (trusted) entity responsible for running a bridge between the networks. It holds $AR and is responsible for minting and burning the equivalent amount of $wAR. Users interact with the bridge when depositing and withdrawing $AR.


## How It Works

### $AR to $wAR

A user first deposits $AR to the bridge Arweave wallet.
Once the deposit has mined, the bridge will pick it up and mint the appropriate amount of $wAR to the provided BSC address.
This is made possible via an [ownable BEP20 contract](contracts/contracts/wAR.sol).

![AR -  wAR](https://user-images.githubusercontent.com/62398724/118025206-77e5af00-b357-11eb-91f8-bb490fca0bdb.png)

### $wAR to $AR

A user first burns their $wAR by interacting with the BEP20 contract.
Once the burn has mined, the bridge will pick it up and transfer the appropriate amount of $AR to the provided Arweave address.

![wAR -  AR](https://user-images.githubusercontent.com/62398724/118025289-92b82380-b357-11eb-860e-a8cdf3b6de27.png)

## Interacting with the bridge

To interact with the bridge, you can either use the UI (WIP) or manually
send a transaction to the wallet provided by the bridge. When sending an
$AR transaction make sure to use the following tags:

```
Application: wAR - BSC
Wallet: [YOUR_BSC_ADDRESS]
```

## Example Transactions

1. The user deposits 0.01 $AR to the bridge Arweave wallet, specifying the target BSC wallet:
<img width="800" alt="deposit-ar" src="https://user-images.githubusercontent.com/11312/118031554-4acfd700-b32c-11eb-96b1-b2cd9e7fbb5b.png">

2. The bridge picks up the deposited $AR, and mints $wAR into the target BSC wallet:
<img width="400" alt="mint-war" src="https://user-images.githubusercontent.com/11312/118031728-7a7edf00-b32c-11eb-8c2d-c7458e6f6ab5.png">

3. The user burns 0.005 $wAR:
<img width="800" alt="burn" src="https://user-images.githubusercontent.com/11312/118032752-a2227700-b32d-11eb-9c76-d3c0e287a32c.png">

4. The bridge picks up the burn and releases $AR to the user:
<img width="800" alt="receive-ar" src="https://user-images.githubusercontent.com/11312/118032650-87500280-b32d-11eb-825b-bb14f16cbd43.png">


## Keeping the bridge decentralised

The bridge is operated by members of a PSC/DAO which allows holders of the PSC tokens to share from proceeds of the bridge and vote on the direction of the bridge.


This allows anyone to buy into the profit-streams of $wAR(BSC). The more $wAR
a user has, the higher the chance for receiving the fee is. Everyone inside the community
can vote on the size of the fee.

### PSC/DAO Link
[PSC/DAO](https://community.xyz/#3mXVO90b-n-aSUTMStO3SLe-tUMduYV5aSWB9n74XXk) 

## Roadmap

- [x] Test on [BSC TestNet](https://www.trufflesuite.com/ganache).
- [ ] Deploy on BSC Mainnet.
- [x] Build a UI for easy usage.
- [x] Implement staking



## Run Dev
cd contracts

npx truffle compile

### Run Migrations
truffle migrate --reset --network BinanceTestnet

#### Run Migration specified in file with prefix x
truffle migrate --f x --reset --network BinanceTestnet [--verbose-rpc]

truffle migrate   --network BinanceTestnet  --compile-all --verbose-rpc



### Run on Console

truffle console --network BinanceTestnet

### Run test

npx truffle test --network BinanceTestnet ../test/test.js



# Bridge
## Run Dev
yarn build

yarn run dev


## Deploy
yarn build
pm2 start npm --name "Arweave BSC Bridge" -- start --interpreter=/root/.nvm/versions/node/v12.18.1/bin/node


