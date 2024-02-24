const axios = require('axios');
const EventEmitter = require('events');



class NewPairFetcher extends EventEmitter {
    constructor(apiKey) {
        super();
        this.apiBaseUrl = 'https://public-api.dextools.io/trial/v2/pool/solana/?sort=creationTime&order=desc&from=2024-02-24T21%3A10%3A40.013Z&to=2024-02-24T21%3A22%3A26.339Z&page=0&pageSize=50';
        this.headers = {
            'accept': 'application/json',
            'x-api-key': apiKey
        };
        this.POLL_INTERVAL = 2000; 

    }

    async fetchNewPairs() {
        const to = new Date().toISOString(); // Use current time as the 'to' parameter
        const from = new Date(Date.now() - 2000000).toISOString(); 

        console.log(`TO: ${to} AND FROM: ${from}`);
        try {
            const response = await axios.get(this.apiBaseUrl, {
                headers: this.headers,
                // params: {
                //     sort: 'creationTime',
                //     order: 'desc',
                //     from: from,
                //     to: to,
                //     page: 0,
                //     pageSize: 50
                // }
            });

            const responseData = response.data;
            console.log(responseData)

            if (responseData && responseData.data && responseData.data.tokens && responseData.data.tokens.length > 0) {
                const tokens = responseData.data.tokens;
                console.log("New tokens found:", tokens);
                this.emit('newTokens', tokens);
            } else {
                console.log("No new tokens found");
            }

            this.lastFetchTime = new Date();

            return responseData;
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
