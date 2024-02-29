const axios = require('axios');
const EventEmitter = require('events');

class NewPairFetcher extends EventEmitter {
    constructor(apiKey) {
        super();
        this.apiBaseUrl = 'https://public-api.dextools.io/trial/v2/pool/solana/';
        this.headers = {
            'accept': 'application/json',
            'x-api-key': apiKey
        };
        this.POLL_INTERVAL = 2000; 
    }

    async fetchNewPairs() {
        const to = new Date().toISOString();
        const from = new Date(Date.now() - 5000).toISOString(); 
        try {
            axios.get(this.apiBaseUrl, {
                headers: this.headers,
                params: {
                    sort: 'creationTime',
                    order: 'desc',
                    from: from,
                    to: to,
                    page: 0,
                    pageSize: 50
                }
            }).then(res => {
                const pairs = res.data.data.results;
                console.log(pairs);
                pairs.forEach(pair => {
                    const mainTokenName = pair.mainToken.name;
                    const mainTokenAddress = pair.mainToken.address;
                    this.emit('newPair', { tokenName: mainTokenName, tokenAddress: mainTokenAddress});
                });
            });
        } catch (error) {
            console.error('Error fetching new tokens:', error);
            this.emit('error', error);
            throw error;
        }
    }

    startPolling() {
        this.fetchNewPairs();
        setInterval(() => this.fetchNewPairs(), this.POLL_INTERVAL);
    }
}

module.exports = NewPairFetcher;