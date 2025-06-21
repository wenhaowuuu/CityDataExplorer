//BUG - Version 1
// const express = require('express');
// const cors = require('cors');
// const fetch = require('node-fetch');
// const path = require('path');

// const app = express();
// const PORT = process.env.PORT || 3000;

// // Middleware
// app.use(cors());
// app.use(express.json());
// app.use(express.static('public'));

// app.get('/api/city-income/:cityName', async(req, res) => {
//     try {
//         const cityName = req.params.cityName.trim();
//         if (!cityName) return res.status(400).json({ error: 'City name is required' });

//         // 1️⃣ Fetch all CA places
//         const placeUrl = 'https://api.census.gov/data/2023/acs/acs5?get=NAME&for=place:*&in=state:06';
//         const placeData = await (await fetch(placeUrl)).json();

//         // 2️⃣ Find matching city
//         const cityEntry = placeData.find(entry => {
//             const name = (entry[0] || '').toLowerCase();
//             return name.includes(cityName.toLowerCase() + ' city') ||
//                 name.includes(cityName.toLowerCase() + ' town') ||
//                 name.startsWith(cityName.toLowerCase() + ',');
//         });
//         if (!cityEntry) {
//             const examples = placeData.slice(1, 6).map(e => e[0] ? e[0].split(',')[0] : '').filter(name => name).join(', ');

//             // const exampleCities = placeData.slice(1, 6).map(entry =>
//             //                     entry[0] ? entry[0].split(',')[0] : ''
//             //                 ).filter(name => name).join(', ');

//             return res.status(404).json({
//                 error: `City "${cityName}" not found`,
//                 suggestion: `Try one of: ${examples}`
//             });
//         }

//         // 3️⃣ Extract FIPS
//         const placeFips = cityEntry[3] || cityEntry[2];

//         // 4️⃣ Pull income + population + no-HS data in one request
//         const dataUrl =
//             `https://api.census.gov/data/2023/acs/acs5/profile` +
//             `?get=NAME,S1901_C01_012E,S0101_C01_001E,S0102_C01_034E` +
//             `&for=place:${placeFips}&in=state:06`;

//         const dataResp = await fetch(dataUrl);
//         if (!dataResp.ok) throw new Error(`Census API status ${dataResp.status}`);

//         const dataJson = await dataResp.json();
//         // [ ["NAME","median","totalPop","noHighSchool","state","place"], [...values...] ]
//         if (dataJson.length < 2)
//             return res.status(500).json({ error: 'Bad data from Census API' });

//         const [,
//             fullName,
//             medianIncomeRaw,
//             totalPopRaw,
//             noHSERaw
//         ] = dataJson[1];

//         // ensure numbers
//         const medianIncome = parseInt(medianIncomeRaw, 10);
//         const totalPopulation = parseInt(totalPopRaw, 10);
//         const adultsNoHighSchool = parseInt(noHSERaw, 10);

//         // format for display
//         const nf = new Intl.NumberFormat('en-US');
//         const fmtIncome = new Intl.NumberFormat('en-US', {
//             style: 'currency',
//             currency: 'USD',
//             minimumFractionDigits: 0
//         }).format(medianIncome);

//         res.json({
//             success: true,
//             cityName: fullName,
//             fipsCode: placeFips,
//             source: '2023 ACS 5-Year Profile',
//             medianIncome,
//             formattedIncome: fmtIncome,
//             totalPopulation,
//             formattedPopulation: nf.format(totalPopulation),
//             adultsNoHighSchool,
//             formattedAdultsNoHighSchool: nf.format(adultsNoHighSchool)
//         });
//     } catch (err) {
//         console.error(err);
//         res.status(500).json({ error: 'Server error', details: err.message });
//     }
// });

// app.get('/api/health', (_, res) => res.json({ status: 'OK' }));
// app.get('/', (_, res) => res.sendFile(path.join(__dirname, 'public', 'index.html')));

// app.listen(PORT, () =>
//     console.log(`Server running on http://localhost:${PORT}`)
// );

// module.exports = app;

//Version 0////
const express = require('express');
const cors = require('cors');
const fetch = require('node-fetch');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.static('public')); // Serve static files from public directory

// API endpoint to search for California city income data
app.get('/api/city-income/:cityName', async(req, res) => {
    try {
        const cityName = req.params.cityName.trim();

        if (!cityName) {
            return res.status(400).json({ error: 'City name is required' });
        }

        console.log(`Searching for city: ${cityName}`);

        // Step 1: Get all California places to find the FIPS code
        const placeUrl = 'https://api.census.gov/data/2023/acs/acs5?get=NAME&for=place:*&in=state:06';
        const placeResponse = await fetch(placeUrl);

        if (!placeResponse.ok) {
            throw new Error(`Place API HTTP error! status: ${placeResponse.status}`);
        }

        const placeData = await placeResponse.json();
        console.log('Sample place data:', placeData.slice(0, 3));

        // Step 2: Find the city in the place data
        const cityEntry = placeData.find(entry => {
            if (!entry[0]) return false;
            const entryName = entry[0].toLowerCase();
            const searchName = cityName.toLowerCase();

            // Try different matching patterns
            return entryName.includes(searchName + ' city') ||
                entryName.includes(searchName + ' town') ||
                entryName.startsWith(searchName + ',') ||
                entryName === searchName + ', california';
        });

        if (!cityEntry) {
            // Get some example cities for the error message
            const exampleCities = placeData.slice(1, 6).map(entry =>
                entry[0] ? entry[0].split(',')[0] : ''
            ).filter(name => name).join(', ');

            return res.status(404).json({
                error: `City "${cityName}" not found in California`,
                suggestion: `Try cities like: ${exampleCities}`
            });
        }

        // Step 3: Extract FIPS code (should be at index 3 based on user feedback)
        const placeFips = cityEntry.length > 3 ? cityEntry[3] : cityEntry[2];
        console.log('Found city entry:', cityEntry);
        console.log('Using FIPS code:', placeFips);

        // Step 4: Get median household income data
        const incomeUrl = `https://api.census.gov/data/2023/acs/acs5/subject?get=NAME,S1901_C01_012E&for=place:${placeFips}&in=state:06`;
        console.log('Income API URL:', incomeUrl);

        const incomeResponse = await fetch(incomeUrl);

        if (!incomeResponse.ok) {
            throw new Error(`Income API HTTP error! status: ${incomeResponse.status}`);
        }

        const incomeData = await incomeResponse.json();
        console.log('Income data response:', incomeData);

        if (incomeData && incomeData.length > 1) {
            const medianIncome = incomeData[1][1];
            const fullCityName = incomeData[1][0];

            if (medianIncome && medianIncome !== 'null' && medianIncome !== null && medianIncome !== '-') {
                // Return successful response
                res.json({
                    success: true,
                    cityName: fullCityName,
                    medianIncome: parseInt(medianIncome),
                    formattedIncome: new Intl.NumberFormat('en-US', {
                        style: 'currency',
                        currency: 'USD',
                        minimumFractionDigits: 0,
                        maximumFractionDigits: 0
                    }).format(parseInt(medianIncome)),
                    source: '2023 ACS 5-Year Estimates',
                    fipsCode: placeFips
                });
            } else {
                res.status(404).json({ error: 'Income data not available for this city' });
            }
        } else {
            res.status(500).json({ error: 'Invalid response format from Census API' });
        }

    } catch (error) {
        console.error('API Error:', error);
        res.status(500).json({
            error: 'Failed to fetch data from Census API',
            details: error.message
        });
    }
});

// Health check endpoint
app.get('/api/health', (req, res) => {
    res.json({ status: 'OK', timestamp: new Date().toISOString() });
});

// Serve the main HTML file
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// Start server
app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
    console.log(`Visit http://localhost:${PORT} to use the application`);
});

module.exports = app;