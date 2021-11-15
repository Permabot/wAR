

const pbtg = artifacts.require('PermabotGold');


module.exports = async function (deployer) {
 
  deployer.deploy(pbtg, 0);
  
};