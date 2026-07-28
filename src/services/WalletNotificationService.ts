export interface IWalletNotificationService {
  pushToCustomer(cardNumber: string, title: string, body: string): Promise<boolean>;
  pushToStore(storeId: string, title: string, body: string): Promise<number>;
}

class StubWalletNotificationService implements IWalletNotificationService {
  async pushToCustomer(cardNumber: string, title: string, body: string): Promise<boolean> {
    console.log(`[WalletNotificationService] pushToCustomer: ${cardNumber} — "${title}: ${body}"`);
    return true;
  }

  async pushToStore(storeId: string, title: string, body: string): Promise<number> {
    console.log(`[WalletNotificationService] pushToStore: store=${storeId} — "${title}: ${body}"`);
    return 0;
  }
}

export const walletNotificationService: IWalletNotificationService = new StubWalletNotificationService();
