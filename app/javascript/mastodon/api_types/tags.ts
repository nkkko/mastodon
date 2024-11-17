interface ApiHistoryJSON {
  day: string;
  accounts: string;
  uses: string;
}

export interface ApiHashtagJSON {
  name: string;
  url: string;
  history: ApiHistoryJSON[];
  following?: boolean;
}
