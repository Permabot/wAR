const { deployProxy } = require('@openzeppelin/truffle-upgrades');

const wPBT = artifacts.require('wPBTUpgradeable');


module.exports = async function (deployer) {
  const instance = await deployProxy(wPBT, [], { deployer });
  console.log('Deployed to ', instance.address);

  // deployer.deploy(moon);
  
};