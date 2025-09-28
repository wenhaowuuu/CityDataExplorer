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

// API endpoint to get census tract demographic data
app.get('/api/tract-data/:state/:county/:tract', async(req, res) => {
    try {
        const { state, county, tract } = req.params;

        // Validate inputs
        if (!state || !county || !tract) {
            return res.status(400).json({
                error: 'State, county, and tract codes are required',
                example: 'Use format: /api/tract-data/06/075/018700 for state 06, county 075, tract 018700'
            });
        }

        // Ensure proper formatting (pad with zeros if needed)
        const stateFips = state.padStart(2, '0');
        const countyFips = county.padStart(3, '0');
        const tractFips = tract.padStart(6, '0');

        console.log(`Fetching data for tract: ${tractFips}, county: ${countyFips}, state: ${stateFips}`);

        // Get comprehensive demographic data in one API call
        // Variables:
        // B19013_001E: Median household income
        // B01001_001E: Total population
        // S1501_C02_015E: Percent 25+ without high school diploma
        // S1701_C03_001E: Percent below poverty level
        const dataUrl = `https://api.census.gov/data/2023/acs/acs5?get=NAME,B19013_001E,B01001_001E&for=tract:${tractFips}&in=state:${stateFips}&in=county:${countyFips}`;

        console.log('Primary data API URL:', dataUrl);

        const dataResponse = await fetch(dataUrl);

        if (!dataResponse.ok) {
            throw new Error(`Census API HTTP error! status: ${dataResponse.status}`);
        }

        const basicData = await dataResponse.json();
        console.log('Basic data response:', basicData);

        if (!basicData || basicData.length < 2) {
            return res.status(404).json({
                error: `Census tract ${tractFips} not found in county ${countyFips}, state ${stateFips}`,
                suggestion: 'Verify the state, county, and tract codes are correct'
            });
        }

        // Get education and poverty data from subject tables
        const subjectDataUrl = `https://api.census.gov/data/2023/acs/acs5/subject?get=NAME,S1501_C02_015E,S1701_C03_001E&for=tract:${tractFips}&in=state:${stateFips}&in=county:${countyFips}`;

        console.log('Subject data API URL:', subjectDataUrl);

        const subjectResponse = await fetch(subjectDataUrl);
        let educationPct = null;
        let povertyPct = null;

        if (subjectResponse.ok) {
            const subjectData = await subjectResponse.json();
            console.log('Subject data response:', subjectData);

            if (subjectData && subjectData.length > 1) {
                educationPct = subjectData[1][1]; // % without HS diploma
                povertyPct = subjectData[1][2]; // % below poverty
            }
        } else {
            console.warn('Subject data not available, will show basic data only');
        }

        // Parse the basic data
        const [tractName, medianIncomeRaw, totalPopRaw] = basicData[1];

        // Convert to numbers and handle null values
        const medianIncome = medianIncomeRaw && medianIncomeRaw !== 'null' && medianIncomeRaw !== '-'
            ? parseInt(medianIncomeRaw) : null;
        const totalPopulation = totalPopRaw && totalPopRaw !== 'null' && totalPopRaw !== '-'
            ? parseInt(totalPopRaw) : null;
        const pctNoHighSchool = educationPct && educationPct !== 'null' && educationPct !== '-'
            ? parseFloat(educationPct) : null;
        const pctInPoverty = povertyPct && povertyPct !== 'null' && povertyPct !== '-'
            ? parseFloat(povertyPct) : null;

        // Format for display
        const nf = new Intl.NumberFormat('en-US');
        const currencyFormatter = new Intl.NumberFormat('en-US', {
            style: 'currency',
            currency: 'USD',
            minimumFractionDigits: 0,
            maximumFractionDigits: 0
        });

        // Build response
        const response = {
            success: true,
            tractName: tractName,
            location: {
                state: stateFips,
                county: countyFips,
                tract: tractFips
            },
            data: {
                medianHouseholdIncome: {
                    value: medianIncome,
                    formatted: medianIncome ? currencyFormatter.format(medianIncome) : 'Data not available'
                },
                totalPopulation: {
                    value: totalPopulation,
                    formatted: totalPopulation ? nf.format(totalPopulation) : 'Data not available'
                },
                percentWithoutHighSchool: {
                    value: pctNoHighSchool,
                    formatted: pctNoHighSchool ? `${pctNoHighSchool.toFixed(1)}%` : 'Data not available'
                },
                percentInPoverty: {
                    value: pctInPoverty,
                    formatted: pctInPoverty ? `${pctInPoverty.toFixed(1)}%` : 'Data not available'
                }
            },
            source: '2023 ACS 5-Year Estimates',
            note: 'Data represents estimates for the 2019-2023 period'
        };

        res.json(response);

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