"use strict";

// ==========================================
// 1. DOM ELEMENTS
// ==========================================

const searchForm = document.getElementById("search-form");
const searchInput = document.getElementById("search-input");
const searchButton = document.getElementById("search-button");

const statusMessage = document.getElementById("status-message");
const destinationGrid = document.getElementById("destination-grid");
const resultCount = document.getElementById("result-count");

const categoryFilter = document.getElementById("category-filter");
const sortFilter = document.getElementById("sort-filter");

const detailsSection = document.getElementById("destination-details");
const detailsContent = document.getElementById("details-content");
const closeDetailsButton = document.getElementById("close-details");

const tripList = document.getElementById("trip-list");
const tripStatus = document.getElementById("trip-status");
const tripCount = document.getElementById("trip-count");
const navTripCount = document.getElementById("nav-trip-count");

const API_KEY = window.GEOAPIFY_API_KEY;

// ==========================================
// 2. APPLICATION STATE
// ==========================================

let destinations = [];
let selectedPlace = null;
let searchRequestNumber = 0;

let myTrip = loadTrip();

const categoryMap = {
    natural: "natural",
    cultural: "tourism.sights",
    architecture: "building"
};

// ==========================================
// 3. HELPER FUNCTIONS
// ==========================================

function createElement(tag, className, text) {
    const element = document.createElement(tag);

    if (className) {
        element.className = className;
    }

    if (text !== undefined) {
        element.textContent = text;
    }

    return element;
}

function makeMapURL(place) {
    const lat = Number(place.lat);
    const lon = Number(place.lon);

    if (!Number.isFinite(lat) || !Number.isFinite(lon)) {
        return null;
    }

    return `https://www.openstreetmap.org/?mlat=${lat}&mlon=${lon}#map=15/${lat}/${lon}`;
}

function getCategory(place) {
    const categories = place.categories || [];

    if (categories.some(category => category.startsWith("natural"))) {
        return {
            label: "Nature",
            icon: "🌿",
            className: "category-nature"
        };
    }

    if (categories.some(category => category.startsWith("building"))) {
        return {
            label: "Architecture",
            icon: "🏛️",
            className: "category-architecture"
        };
    }

    if (categories.some(category => category.startsWith("tourism.sights"))) {
        return {
            label: "Culture & sights",
            icon: "🏛️",
            className: "category-culture"
        };
    }

    return {
        label: "Place to explore",
        icon: "📍",
        className: "category-general"
    };
}

function setStatus(message, type = "") {
    statusMessage.textContent = message;
    statusMessage.className = "status-message";

    if (type) {
        statusMessage.classList.add(`status-${type}`);
    }
}

// Normalize names and addresses to make duplicate comparisons reliable.
function normalizePlaceText(value) {
    return String(value || "")
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "")
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, " ")
        .trim();
}

// Calculate the straight-line distance between two places in metres.
function distanceInMeters(a, b) {
    const toRadians = degrees => degrees * Math.PI / 180;

    const lat1 = Number(a.lat);
    const lon1 = Number(a.lon);
    const lat2 = Number(b.lat);
    const lon2 = Number(b.lon);

    if (![lat1, lon1, lat2, lon2].every(Number.isFinite)) {
        return Infinity;
    }

    const dLat = toRadians(lat2 - lat1);
    const dLon = toRadians(lon2 - lon1);

    const value =
        Math.sin(dLat / 2) ** 2 +
        Math.cos(toRadians(lat1)) *
        Math.cos(toRadians(lat2)) *
        Math.sin(dLon / 2) ** 2;

    return 6371000 * 2 * Math.atan2(
        Math.sqrt(value),
        Math.sqrt(Math.max(0, 1 - value))
    );
}

// Remove duplicate attractions while preserving distinct nearby places.
function removeDuplicatePlaces(places) {
    const uniquePlaces = [];

    for (const place of places) {
        const nameKey = normalizePlaceText(place.name);
        const addressKey = normalizePlaceText(place.address);

        const isDuplicate = uniquePlaces.some(existing => {
            const sameName =
                nameKey === normalizePlaceText(existing.name);

            const sameAddress =
                addressKey === normalizePlaceText(existing.address);

            const nearby =
                distanceInMeters(place, existing) <= 250;

            return sameName && (sameAddress || nearby);
        });

        if (!isDuplicate) {
            uniquePlaces.push(place);
        }
    }

    return uniquePlaces;
}

// ==========================================
// 4. LOAD SAVED ITINERARY
// ==========================================

function loadTrip() {
    try {
        const saved = JSON.parse(
            localStorage.getItem("tripwise-itinerary") || "[]"
        );

        if (!Array.isArray(saved)) {
            return [];
        }

        const validPlaces = saved.filter(place =>
            place &&
            typeof place.id === "string" &&
            typeof place.name === "string"
        );

        // Remove duplicate saved IDs.
        return validPlaces.filter((place, index, array) =>
            array.findIndex(item => item.id === place.id) === index
        );

    } catch (error) {
        console.error("Could not load saved itinerary:", error);
        return [];
    }
}

// ==========================================
// 5. SEARCH CITY AND NEARBY PLACES
// ==========================================

async function searchDestinations(city) {
    if (
        !API_KEY ||
        API_KEY === "PASTE_YOUR_API_KEY_HERE"
    ) {
        setStatus("Geoapify API key is missing. Check config.js.", "error");
        return;
    }

    const requestNumber = ++searchRequestNumber;

    searchButton.disabled = true;
    searchButton.textContent = "Searching...";

    setStatus(`Finding places near ${city}...`, "loading");

    destinationGrid.replaceChildren();
    resultCount.textContent = "";
    closeDetails();

    try {
        // Step A: Convert the city name into coordinates.
        const geoURL = new URL(
            "https://api.geoapify.com/v1/geocode/search"
        );

        geoURL.search = new URLSearchParams({
            text: `${city}, India`,
            format: "json",
            limit: "1",
            apiKey: API_KEY
        });

        const geoResponse = await fetch(geoURL);

        if (!geoResponse.ok) {
            throw new Error(
                `City search failed with HTTP ${geoResponse.status}`
            );
        }

        const geoData = await geoResponse.json();
        const location = geoData.results?.[0];

        if (requestNumber !== searchRequestNumber) {
            return;
        }

        if (!location) {
            destinations = [];
            renderDestinations();
            setStatus(
                "No matching city found. Try another search.",
                "empty"
            );
            return;
        }

        // Step B: Find nearby attractions.
        const placesURL = new URL(
            "https://api.geoapify.com/v2/places"
        );

        placesURL.search = new URLSearchParams({
            categories: "tourism.sights,natural",
            filter: `circle:${location.lon},${location.lat},15000`,
            bias: `proximity:${location.lon},${location.lat}`,
            limit: "20",
            lang: "en",
            apiKey: API_KEY
        });

        const placesResponse = await fetch(placesURL);

        if (!placesResponse.ok) {
            throw new Error(
                `Place search failed with HTTP ${placesResponse.status}`
            );
        }

        const placesData = await placesResponse.json();

        if (requestNumber !== searchRequestNumber) {
            return;
        }

        // Convert API results into the format used by TripWise.
        const candidates = (placesData.features || [])
            .map(feature => feature.properties)
            .filter(place =>
                place &&
                place.name &&
                place.place_id
            )
            .map(place => ({
                id: String(place.place_id),
                name: place.name.trim(),
                address: place.formatted || city,
                categories: Array.isArray(place.categories)
                    ? place.categories
                    : [],
                lat: place.lat,
                lon: place.lon
            }));

        // Remove duplicate results before displaying the cards.
        destinations = removeDuplicatePlaces(candidates);

        renderDestinations();

        if (destinations.length) {
            setStatus(
                `Here are some places to explore near ${city}.`,
                "success"
            );
        } else {
            setStatus(
                `No attractions found near ${city}. Try another city.`,
                "empty"
            );
        }

    } catch (error) {
        if (requestNumber !== searchRequestNumber) {
            return;
        }

        console.error("TripWise API error:", error);

        destinations = [];
        renderDestinations();

        setStatus(
            "We couldn't load destinations. Check your connection and try again.",
            "error"
        );

    } finally {
        if (requestNumber === searchRequestNumber) {
            searchButton.disabled = false;
            searchButton.textContent = "Explore places";
        }
    }
}

// ==========================================
// 6. FILTER AND SORT PLACES
// ==========================================

function renderDestinations() {
    destinationGrid.replaceChildren();

    let filtered = [...destinations];

    const selectedCategory = categoryFilter.value;

    if (selectedCategory !== "all") {
        const targetCategory = categoryMap[selectedCategory];

        filtered = filtered.filter(place =>
            place.categories.some(category =>
                category === targetCategory ||
                category.startsWith(targetCategory + ".")
            )
        );
    }

    if (sortFilter.value === "name") {
        filtered.sort((a, b) => a.name.localeCompare(b.name));
    } else if (sortFilter.value === "name-desc") {
        filtered.sort((a, b) => b.name.localeCompare(a.name));
    }

    resultCount.textContent =
        `${filtered.length} place${filtered.length === 1 ? "" : "s"}`;

    if (!filtered.length) {
        if (destinations.length > 0) {
            setStatus(
                "No places match this category. Try another filter.",
                "empty"
            );
        }

        return;
    }

    const fragment = document.createDocumentFragment();

    filtered.forEach(place => {
        const category = getCategory(place);

        const card = createElement("article", "destination-card");

        const visual = createElement(
            "div",
            `destination-visual ${category.className}`
        );

        const icon = createElement(
            "span",
            "destination-icon",
            category.icon
        );
        icon.setAttribute("aria-hidden", "true");

        const categoryLabel = createElement(
            "span",
            "category-badge",
            category.label
        );

        visual.append(icon, categoryLabel);

        const content = createElement(
            "div",
            "destination-card-content"
        );

        content.appendChild(
            createElement("p", "destination-kicker", "DESTINATION")
        );

        content.appendChild(
            createElement("h3", "destination-title", place.name)
        );

        content.appendChild(
            createElement("p", "destination-address", place.address)
        );

        const actions = createElement("div", "destination-actions");

        const detailsButton = createElement(
            "button",
            "details-button",
            "View details"
        );

        detailsButton.type = "button";
        detailsButton.addEventListener(
            "click",
            () => showDetails(place)
        );

        const alreadySaved = myTrip.some(
            item => item.id === place.id
        );

        const addButton = createElement(
            "button",
            "secondary-button add-button",
            alreadySaved ? "Saved ✓" : "＋ Add to trip"
        );

        addButton.type = "button";
        addButton.disabled = alreadySaved;

        addButton.addEventListener("click", () => {
            if (addToTrip(place)) {
                addButton.textContent = "Saved ✓";
                addButton.disabled = true;
            }
        });

        actions.append(detailsButton, addButton);
        content.appendChild(actions);

        card.append(visual, content);
        fragment.appendChild(card);
    });

    destinationGrid.appendChild(fragment);
}

// ==========================================
// 7. DESTINATION DETAILS PANEL
// ==========================================

function showDetails(place) {
    selectedPlace = place;

    detailsContent.replaceChildren();

    const category = getCategory(place);

    const banner = createElement(
        "div",
        `details-visual ${category.className}`
    );

    banner.appendChild(
        createElement("span", "details-icon", category.icon)
    );

    banner.appendChild(
        createElement("span", "category-badge", category.label)
    );

    const body = createElement("div", "details-body");

    body.appendChild(
        createElement("p", "eyebrow", "DESTINATION INFORMATION")
    );

    body.appendChild(
        createElement("h3", "details-title", place.name)
    );

    body.appendChild(
        createElement("p", "details-address", place.address)
    );

    const coordinates = createElement(
        "p",
        "details-coordinates"
    );

    if (
        Number.isFinite(Number(place.lat)) &&
        Number.isFinite(Number(place.lon))
    ) {
        coordinates.textContent =
            `Latitude: ${place.lat} · Longitude: ${place.lon}`;
    } else {
        coordinates.textContent = "Coordinates unavailable.";
    }

    body.appendChild(coordinates);

    const actions = createElement("div", "details-actions");

    const mapURL = makeMapURL(place);

    if (mapURL) {
        const mapLink = createElement(
            "a",
            "details-button",
            "Open map ↗"
        );

        mapLink.href = mapURL;
        mapLink.target = "_blank";
        mapLink.rel = "noopener noreferrer";

        actions.appendChild(mapLink);
    }

    const alreadySaved = myTrip.some(
        item => item.id === place.id
    );

    const addButton = createElement(
        "button",
        "add-button",
        alreadySaved ? "Already in My Trip ✓" : "Add to My Trip"
    );

    addButton.type = "button";
    addButton.disabled = alreadySaved;

    addButton.addEventListener("click", () => {
        if (addToTrip(place)) {
            addButton.textContent = "Added to My Trip ✓";
            addButton.disabled = true;
            renderDestinations();
        }
    });

    actions.appendChild(addButton);
    body.appendChild(actions);

    detailsContent.append(banner, body);

    detailsSection.hidden = false;

    detailsSection.scrollIntoView({
        behavior: "smooth",
        block: "start"
    });
}

function closeDetails() {
    selectedPlace = null;
    detailsSection.hidden = true;
    detailsContent.replaceChildren();
}

closeDetailsButton.addEventListener("click", closeDetails);

// ==========================================
// 8. SAVE AND ADD PLACES
// ==========================================

function addToTrip(place) {
    if (myTrip.some(item => item.id === place.id)) {
        tripStatus.textContent =
            "This place is already in My Trip.";
        return false;
    }

    myTrip.push(place);

    if (!saveTrip()) {
        myTrip.pop();
        return false;
    }

    tripStatus.textContent = `${place.name} added to My Trip!`;

    renderDestinations();

    return true;
}

function saveTrip() {
    try {
        localStorage.setItem(
            "tripwise-itinerary",
            JSON.stringify(myTrip)
        );

        renderTrip();
        return true;

    } catch (error) {
        console.error("Could not save itinerary:", error);

        tripStatus.textContent =
            "Unable to save your trip. Check browser storage settings.";

        return false;
    }
}

// ==========================================
// 9. REMOVE PLACES
// ==========================================

function removeFromTrip(id) {
    const previousTrip = [...myTrip];

    myTrip = myTrip.filter(place => place.id !== id);

    if (!saveTrip()) {
        myTrip = previousTrip;
        renderTrip();
        return;
    }

    tripStatus.textContent =
        "Destination removed from My Trip.";

    renderDestinations();

    if (selectedPlace && selectedPlace.id === id) {
        closeDetails();
    }
}

// ==========================================
// 10. RENDER MY TRIP
// ==========================================

function renderTrip() {
    tripList.replaceChildren();

    tripCount.textContent = `(${myTrip.length})`;
    navTripCount.textContent = myTrip.length;

    if (myTrip.length === 0) {
        tripStatus.textContent =
            "Your trip is empty. Explore destinations and add a place.";

        tripStatus.className =
            "status-message status-empty";

        return;
    }

    tripStatus.textContent =
        `${myTrip.length} saved destination${myTrip.length === 1 ? "" : "s"}.`;

    tripStatus.className =
        "status-message status-success";

    const fragment = document.createDocumentFragment();

    myTrip.forEach(place => {
        const category = getCategory(place);

        const item = createElement("article", "trip-item");

        const icon = createElement(
            "div",
            `trip-item-icon ${category.className}`,
            category.icon
        );

        icon.setAttribute("aria-hidden", "true");

        const info = createElement("div", "trip-item-info");

        info.appendChild(
            createElement("h3", "trip-item-title", place.name)
        );

        info.appendChild(
            createElement(
                "p",
                "trip-item-address",
                place.address || ""
            )
        );

        const actions = createElement(
            "div",
            "trip-item-actions"
        );

        const mapURL = makeMapURL(place);

        if (mapURL) {
            const mapLink = createElement(
                "a",
                "map-text-link",
                "Map ↗"
            );

            mapLink.href = mapURL;
            mapLink.target = "_blank";
            mapLink.rel = "noopener noreferrer";

            actions.appendChild(mapLink);
        }

        const removeButton = createElement(
            "button",
            "remove-button",
            "Remove"
        );

        removeButton.type = "button";

        removeButton.addEventListener("click", () => {
            removeFromTrip(place.id);
        });

        actions.appendChild(removeButton);

        item.append(icon, info, actions);
        fragment.appendChild(item);
    });

    tripList.appendChild(fragment);
}

// ==========================================
// 11. SEARCH AND FILTER EVENTS
// ==========================================

searchForm.addEventListener("submit", event => {
    event.preventDefault();

    const city = searchInput.value.trim();

    if (!city) {
        setStatus("Please enter a city to explore.", "error");
        searchInput.focus();
        return;
    }

    searchDestinations(city);
});

categoryFilter.addEventListener("change", renderDestinations);
sortFilter.addEventListener("change", renderDestinations);

// ==========================================
// 12. INITIALIZE APP
// ==========================================

renderTrip();