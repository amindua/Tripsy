const express = require('express');
const router = express.Router();
const app = express();
const { MongoClient, ServerApiVersion, ObjectId } = require('mongodb');
require('dotenv').config();
const path = require('path');
const bodyParser = require('body-parser');
app.use(bodyParser.urlencoded({extended:false}));

const uri    = process.env.MONGO_CONNECTION_STRING;
const client = new MongoClient(uri, { serverApi: { version: ServerApiVersion.v1 } });

const DB_NAME = process.env.MONGO_DB_NAME;
const TRIPS_COLLECTION = process.env.MONGO_COLLECTION2;
app.use(express.static(path.join(__dirname, "public")));

app.set("view engine", "ejs");
app.set("views", path.resolve(__dirname, "templates"));

const TRIPADVISOR_API_KEY = process.env.API_KEY

function ensureLoggedIn(req, res, next) {
  if (!req.session.user) {
    return res.redirect('/login');
  }
  next();
}

router.get('/', ensureLoggedIn, async (req, res) => {
  try {
    await client.connect();
    const db    = client.db(DB_NAME);
    const trips = await db.collection(TRIPS_COLLECTION).find({username: req.session.user}).toArray();

    trips.forEach(trip => {
        trip.hotels = (trip.hotels || []).map(hotel => {
            let raw = hotel.web_url || hotel.details?.web_url || '';
            if (raw && !raw.startsWith('http')) {
            raw = 'https://www.tripadvisor.com' + raw;
            }
            return { ...hotel, web_url: raw };
        });
        trip.restaurants = (trip.restaurants || []).map(restaurant => {
            let raw = restaurant.web_url || restaurant.details?.web_url || '';
            if (raw && !raw.startsWith('http')) {
            raw = 'https://www.tripadvisor.com' + raw;
            }
            return { ...restaurant, web_url: raw };
        });
        trip.attractions = (trip.attractions || []).map(attraction => {
            let raw = attraction.web_url || attraction.details?.web_url || '';
            if (raw && !raw.startsWith('http')) {
            raw = 'https://www.tripadvisor.com' + raw;
            }
            return { ...attraction, web_url: raw };
        });
    });

    res.render('home', { trips, firstName: req.session.firstName });
  } catch (err) {
    console.error(err);
    res.status(500).send('Server error');
  } finally {
    await client.close();
  }
});


router.get('/create', (req, res) => {
  res.render('create');
});


router.post('/published', ensureLoggedIn, async (req, res) => {
    const { title, origin, date, date2, adults, children, notes } = req.body;
    let destination = req.body.destination.trim().toLowerCase();
    const encodedDestination = encodeURIComponent(destination);
    let hotels = [];
    let restaurants  = [];
    let attractions = [];
    if (!title || !origin || !destination || !date || !adults) {
        return res.render('create', {
            error: 'Please fill in all required fields.',
            formData: req.body
        });
    }
    try {
        hotels = await fetchTripAdvisorDataWithDetails(encodedDestination, 'hotels');
        console.log('Hotel URLs:', hotels.map(h => h.web_url));

        restaurants = await fetchTripAdvisorDataWithDetails(encodedDestination, 'restaurants');
        attractions = await fetchTripAdvisorDataWithDetails(encodedDestination, 'attractions');

        console.log(`SERVER: Hotels (with details) processed for ${destination}:`, hotels.length);
        console.log(`SERVER: Restaurants (with details) processed for ${destination}:`, restaurants.length);
        console.log(`SERVER: Attractions (with details) processed for ${destination}:`, attractions.length);
      
    } catch (error) {
        console.error('SERVER: Error fetching TA data:', err);
        return res.render('create', {
            error: 'Unable to verify destination right now. Please re-enter.',
            formData: req.body
        });
    }
    
        
    try {
        await client.connect();
        const db = client.db(DB_NAME);
        await db.collection(TRIPS_COLLECTION).insertOne({
            username: req.session.user,
            title,
            origin,
            destination,
            date,
            date2,
            adults,
            children,
            hotels,
            restaurants,
            attractions,
            notes
        });
        res.redirect('/');
    } catch (err) {
        console.error(err);
        res.status(500).send('Server error');
    } finally {
        await client.close();
    }
    });

    router.post('/delete/:id', ensureLoggedIn, async (req, res) => {
    const tripId = req.params.id;
    try {
        await client.connect();
        await client
        .db(DB_NAME)
        .collection(TRIPS_COLLECTION)
        .deleteOne({
            _id: new ObjectId(tripId),
            username: req.session.user    
        });

        res.redirect('/');
    } catch (err) {
        console.error('Delete error:', err);
        res.status(500).send('Server error');
    } finally {
        await client.close();
    }
});

module.exports = router;
async function fetchLocationDetailsById(locationId) {
  if (!locationId) return null;

  const url = `https://api.content.tripadvisor.com/api/v1/location/${locationId}/details?key=${TRIPADVISOR_API_KEY}&language=en&currency=USD`;
  const options = {
    method: 'GET',
    headers: { accept: 'application/json' }
  };

  console.log(`SERVER: Fetching details for Location ID: ${locationId}`);
  try {
    const response = await fetch(url, options);
    if (!response.ok) {
      const errorData = await response.json().catch(() => ({ message: response.statusText }));
      console.error(`SERVER: API Error for Location Details ${locationId} (${response.status}):`, errorData.message || response.statusText);
      return { error: true, message: `Failed to fetch details for ${locationId}. Status: ${response.status}` };
    }
    const details = await response.json();
    return details;
  } catch (error) {
    console.error(`SERVER: Error in fetchLocationDetailsById for ${locationId}:`, error);
    return { error: true, message: `Exception fetching details for ${locationId}.` };
  }
}

async function fetchTripAdvisorDataWithDetails(destination, category) {
  const encodedSearchQuery = encodeURIComponent(destination);
  const searchUrl = `https://api.content.tripadvisor.com/api/v1/location/search?key=${TRIPADVISOR_API_KEY}&searchQuery=${encodedSearchQuery}&category=${category}&language=en`;
  const searchOptions = {
    method: 'GET',
    headers: { accept: 'application/json' }
  };

  console.log(`SERVER: Searching ${category} for: ${destination}`);
  try {
    const searchResponse = await fetch(searchUrl, searchOptions);
    if (!searchResponse.ok) {
      const errorData = await searchResponse.json().catch(() => ({ message: searchResponse.statusText }));
      console.error(`SERVER: API Error for ${category} Search (${searchResponse.status}):`, errorData.message || searchResponse.statusText);
      throw new Error(`Failed to search ${category}. Status: ${searchResponse.status}`);
    }
    const searchJson = await searchResponse.json();

    const initialLocations = searchJson.data ? searchJson.data.slice(0, 5) : [];

    if (initialLocations.length === 0) {
      return [];
    }

    const locationsWithDetailsPromises = initialLocations.map(async (location) => {
      const details = await fetchLocationDetailsById(location.location_id);
      return {
        ...location,
        web_url: details && !details.error ? details.web_url : null
      };
    });
    const locationsWithDetails = await Promise.all(locationsWithDetailsPromises);
    return locationsWithDetails;

  } catch (error) {
    console.error(`SERVER: Error in fetchTripAdvisorDataWithDetails for ${category}:`, error);
    return [];
  }
}