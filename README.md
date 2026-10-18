# TripWise 🌍

**Discover destinations. Explore new places. Plan your next trip.**

TripWise is a responsive travel discovery and itinerary-planning web application built with HTML, CSS, and JavaScript. It uses the Geoapify API to find destinations and helps users organize places they want to visit.

## 🚀 Live Demo

[Explore TripWise](https://cute-dieffenbachia-ac9bbf.netlify.app/)

## ✨ Features

- **Destination Search:** Search for cities in India and discover nearby attractions.
- **Category Filters:** Filter destinations by nature, culture and sights, and architecture.
- **Sorting:** Sort destinations alphabetically.
- **Destination Details:** View place names, addresses, coordinates, and map links.
- **Personal Itinerary:** Add and remove destinations from your trip.
- **Local Persistence:** Save itinerary data in browser local storage.
- **Duplicate Filtering:** Reduce repeated destination results.
- **Responsive Interface:** Designed to work across different screen sizes.
- **Loading and Error States:** Receive feedback during searches and when results are unavailable.

## 🛠️ Tech Stack

- HTML5
- CSS3
- JavaScript (Vanilla JS)
- Geoapify Geocoding API
- Geoapify Places API
- Browser Local Storage
- OpenStreetMap links

## 📁 Project Structure

```text
TripWise/
├── index.html
├── style.css
├── script.js
├── config.js       # Local API configuration; not committed
└── .gitignore
```

## ⚙️ Run Locally

1. Clone or download this repository.
2. Open the project folder in your code editor.
3. Obtain an API key from [Geoapify](https://www.geoapify.com/).
4. Create a local `config.js` file in the project root:

```javascript
window.GEOAPIFY_API_KEY = "YOUR_GEOAPIFY_API_KEY";
```

5. Make sure `config.js` is loaded before `script.js` in `index.html`.
6. Run the project using VS Code Live Server or another local web server.

**Security note:** `config.js` is excluded from Git using `.gitignore`. Browser-based API keys are visible to users of the website, so configure appropriate restrictions and usage limits in Geoapify.

## 🧭 How It Works

1. Enter a city name.
2. TripWise uses Geoapify Geocoding to find the city's coordinates.
3. The Places API retrieves nearby attractions.
4. Filter, sort, and inspect the returned destinations.
5. Add interesting places to your itinerary.
6. Your saved itinerary remains available in the same browser through local storage.

## 🔮 Future Improvements

- Destination photographs and richer place descriptions
- More advanced category filters
- Itinerary export and sharing
- Travel distance and route planning
- Improved accessibility and user experience

## 👨‍💻 Author

Developed as a frontend web development project.

---

*TripWise — Make every journey count.*
