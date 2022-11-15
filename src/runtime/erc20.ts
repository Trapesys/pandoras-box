import { BigNumber } from '@ethersproject/bignumber';
import { Contract, ContractFactory } from '@ethersproject/contracts';
import {
    JsonRpcProvider,
    Provider,
    TransactionRequest,
} from '@ethersproject/providers';
import { parseUnits } from '@ethersproject/units';
import { Wallet } from '@ethersproject/wallet';
import ZexCoin from '../contracts/ZexCoinERC20.json';
import Logger from '../logger/logger';
import { senderAccount } from './signer';

class ERC20Runtime {
    mnemonic: string;
    url: string;
    provider: Provider;

    gasEstimation: BigNumber = BigNumber.from(0);
    gasPrice: BigNumber = BigNumber.from(0);

    defaultValue: BigNumber = parseUnits('0.0');
    defaultTransferValue: number = 0.001;

    totalSupply: number = 500000000000;
    coinName: string = 'Zex Coin';
    coinSymbol: string = 'ZEX';

    contract: Contract | undefined;

    baseDeployer: Wallet;

    constructor(mnemonic: string, url: string) {
        this.mnemonic = mnemonic;
        this.provider = new JsonRpcProvider(url);
        this.url = url;

        this.baseDeployer = Wallet.fromMnemonic(
            this.mnemonic,
            `m/44'/60'/0'/0/0`
        );
    }

    async Initialize() {
        //  Deploy the contract
        const address = await this.deployERC20();

        // Initialize it
        this.contract = new Contract(address, ZexCoin.abi, this.provider);
    }

    async deployERC20(): Promise<string> {
        const contract = await new ContractFactory(
            ZexCoin.abi,
            ZexCoin.bytecode,
            this.baseDeployer
        ).deploy(this.totalSupply, this.coinName, this.coinSymbol);

        return contract.address;
    }

    async EstimateBaseTx(): Promise<BigNumber> {
        if (!this.contract) {
            return BigNumber.from(0);
        }

        // Estimate a simple transfer transaction
        this.gasEstimation = await this.contract.estimateGas.transfer(
            Wallet.fromMnemonic(this.mnemonic, `m/44'/60'/0'/0/1`).address,
            this.defaultTransferValue
        );

        return this.gasEstimation;
    }

    GetTransferValue(): number {
        return this.defaultTransferValue;
    }

    async GetTokenBalance(address: string): Promise<number> {
        if (!this.contract) {
            return 0;
        }

        return await this.contract.balanceOf(address);
    }

    async GetSupplierBalance(): Promise<number> {
        return this.GetTokenBalance(this.baseDeployer.address);
    }

    async FundAccount(to: string, amount: number): Promise<void> {
        if (!this.contract) {
            return;
        }

        await this.contract.transfer(to, amount);
    }

    GetTokenName(): string {
        return this.coinName;
    }

    GetValue(): BigNumber {
        return this.defaultValue;
    }

    async GetGasPrice(): Promise<BigNumber> {
        this.gasPrice = await this.provider.getGasPrice();

        return this.gasPrice;
    }

    async ConstructTransactions(
        accounts: senderAccount[],
        numTx: number
    ): Promise<TransactionRequest[]> {
        const queryWallet = Wallet.fromMnemonic(
            this.mnemonic,
            `m/44'/60'/0'/0/0`
        ).connect(this.provider);

        const chainID = await queryWallet.getChainId();
        const gasPrice = this.gasPrice;

        Logger.info(`Chain ID: ${chainID}`);
        Logger.info(`Avg. gas price: ${gasPrice.toHexString()}`);

        const transactions: TransactionRequest[] = [];

        for (let i = 0; i < numTx; i++) {
            const senderIndex = i % accounts.length;
            const receiverIndex = (i + 1) % accounts.length;

            const sender = accounts[senderIndex];
            const receiver = accounts[receiverIndex];

            transactions.push({
                from: sender.getAddress(),
                chainId: chainID,
                to: receiver.getAddress(),
                gasPrice: gasPrice,
                gasLimit: this.gasEstimation,
                value: this.defaultValue,
                nonce: sender.getNonce(),
            });

            sender.incrNonce();
        }

        return transactions;
    }

    GetStartMessage(): string {
        return '\n⚡️ ERC20 token transfers initialized ️⚡️\n';
    }
}

export default ERC20Runtime;
