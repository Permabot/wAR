import { readContract } from "smartweave";
require("dotenv").config();

const TURN_ARWEAVE_FEE_OFF = process.env.TURN_ARWEAVE_FEE_OFF == 'true';
const TURN_BSC_FEE_OFF = process.env.TURN_BSC_FEE_OFF == 'true';

const weightedRandom = (dict: Record<string, number>): string | undefined => {
  let sum = 0;
  const r = Math.random();

  for (const addr of Object.keys(dict)) {
    sum += dict[addr];
    if (r <= sum && dict[addr] > 0) {
      return addr;
    }
  }

  return;
};

export const selectTokenHolder = async (
  client: any,
  PSC_CONTRACT_ID: string
): Promise<string> => {
  const state = await readContract(client, PSC_CONTRACT_ID);
  const balances = state.balances;
  const vault = state.vault;

  let total = 0;
  for (const addr of Object.keys(balances)) {
    total += balances[addr];
  }

  for (const addr of Object.keys(vault)) {
    if (!vault[addr].length) continue;

    const vaultBalance = vault[addr]
      .map((a: { balance: number; start: number; end: number }) => a.balance)
      .reduce((a: number, b: number) => a + b, 0);

    total += vaultBalance;

    if (addr in balances) {
      balances[addr] += vaultBalance;
    } else {
      balances[addr] = vaultBalance;
    }
  }

  const weighted: { [addr: string]: number } = {};
  for (const addr of Object.keys(balances)) {
    weighted[addr] = balances[addr] / total;
  }

  return weightedRandom(weighted)!;
};

export const getARFeePercent = async (
  client: any,
  PSC_CONTRACT_ID: string
): Promise<number> => {

  if(TURN_ARWEAVE_FEE_OFF === true ){
    return 0;
  }
  const DEFAULT_FEE = process.env.ARWEAVE_FEE!;

  const contract = await readContract(client, PSC_CONTRACT_ID);

  const fee = contract.settings.find(
    (setting: (string | number)[]) =>
      setting[0].toString().toLowerCase() === "fee"
  );

  return fee ? fee[1] : DEFAULT_FEE;
};

export const getPSTFeePercentage = async (
  client: any,
  PSC_CONTRACT_ID: string
): Promise<number> => {

  

  const DEFAULT_FEE = process.env.ARWEAVE_PST_FEE!;

  const contract = await readContract(client, PSC_CONTRACT_ID);

  const fee = contract.settings.find(
    (setting: (string | number)[]) =>
      setting[0].toString().toLowerCase() === "pstfee"
  );

  return fee ? fee[1] : DEFAULT_FEE;
}

export const calculatePSTFeeCharged = (
  totalAmount: number,
  PERCENTFEE: number
): number => {


  if(TURN_ARWEAVE_FEE_OFF === true || PERCENTFEE <= 0 ){
    return 0;
  }
  
  let FEE = 1; // totalAmount <=101
  
  if(totalAmount <=101){
      FEE=1;
  }
  else if(totalAmount <=202){
      FEE=2;
  }else if(totalAmount >202){
      FEE = Math.ceil(totalAmount - (totalAmount/(PERCENTFEE+1) ) ) ;
  }

  return FEE;

}

