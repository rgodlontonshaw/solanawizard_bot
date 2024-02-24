import axios from 'axios';


class NewPairFetcher {
    async fetchNewPairs() {
        try {
            const response = await axios.get(`${this.apiBaseUrl}/newPairsEndpoint`); // Replace '/newPairsEndpoint' with the actual endpoint
            const pairs = response.data; // Adjust based on the API response structure
            console.log(pairs); // For debugging, remove or replace with proper logging
            return pairs; // Return the fetched pairs for further processing
        } catch (error) {
            console.error('Error fetching new pairs:', error);
            throw error; // Rethrow or handle as needed
        }
    }
}

module.exports = NewPairFetcher;
