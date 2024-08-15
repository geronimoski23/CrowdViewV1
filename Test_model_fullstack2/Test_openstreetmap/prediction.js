let heat;
let map;
let intervalId = null;
let selectedBuilding = null;
let buildings = [];
let buildingLayers = [];
let viewByHour = false;
let lastSelectedMinute = 0;
let lastSelectedHour = 0;

window.onload = init;

async function fetchCampusPredictions(date, time) {
    const url = `http://127.0.0.1:8000/api/v1/predict/campus/datetime/${date}T${time}/`;
    //console.log(`Fetching campus predictions with URL: ${url}`);
    try {
        const response = await fetch(url);
        if (!response.ok) {
            throw new Error(`HTTP error! Status: ${response.status}`);
        }
        const result = await response.json();
        //console.log('Received campus predictions data:', result);
        return result.predictions || {};
    } catch (error) {
        console.error('Error fetching campus predictions data:', error);
        return {};
    }
}

async function fetchBuildingPredictions(building, date, time) {
    const url = `http://127.0.0.1:8000/api/v1/predict/datetime/${date}T${time}/?building=${building}`;
    //console.log(`Fetching building predictions with URL: ${url}`);
    try {
        const response = await fetch(url);
        if (!response.ok) {
            throw new Error(`HTTP error! Status: ${response.status}`);
        }
        const result = await response.json();
        //console.log('Received building predictions data:', result);
        return result.prediction || [];
    } catch (error) {
        console.error(`Error fetching building predictions for ${building}:`, error);
        return [];
    }
}

function init() {
    map = L.map('mapid').setView([42.392, -72.527], 16);

    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
        maxZoom: 19,
    }).addTo(map);

    heat = L.heatLayer([], {
        radius: 30,
        blur: 20,
        maxZoom: 22,
        maxOpacity: 0.9,
        gradient: {
            0.1: 'blue',
            0.3: 'cyan',
            0.5: 'teal',
            0.7: 'yellow',
            1.0: 'orange'
        }
    }).addTo(map);

    const timebar = document.getElementById('timebar');
    timebar.addEventListener('input', debounce(updateHeatmapData, 300));
    timebar.addEventListener('change', () => {
        if (selectedBuilding) {
            const time = viewByHour ? parseInt(timebar.value) * 60 : timebar.value;
            updateBuildingStats(selectedBuilding.name, getDateInput(), time);
        }
    });

    document.getElementById('start-button').addEventListener('click', startAnimation);
    document.getElementById('stop-button').addEventListener('click', stopAnimation);
    document.getElementById('view-occupancy-button').addEventListener('click', handleDateInput);

    initializeBuildings();

    setInterval(updateHeatmapData, 10000);
}



async function initializeBuildings() {
    const date = getDateInput();
    const time = '13:00';
    const campusPredictions = await fetchCampusPredictions(date, time);

    if (campusPredictions) {
        //console.log('Initializing buildings...');
        buildings = Object.keys(campusPredictions).map(building => ({
            name: building,
            lat: campusPredictions[building].lat,
            long: campusPredictions[building].long
        }));
        createBuildingButtons(buildings);
        addBuildingLayers(buildings);
        updateHeatmapData(date);
    }
}

function createBuildingButtons(buildings) {
    const container = document.getElementById('building-buttons-container');
    container.innerHTML = '';

    const campusButton = document.createElement('button');
    campusButton.className = 'building-button';
    campusButton.innerText = 'Campus';
    campusButton.setAttribute('data-building', 'campus');
    campusButton.addEventListener('click', () => {
        selectedBuilding = null;
        map.setView([42.392, -72.527], 17);
        updateHeatmapData(getDateInput());
        clearBuildingStats();
    });
    container.appendChild(campusButton);

}

function addBuildingLayers(buildings) {
    buildings.forEach(building => {
        const layer = L.circle([building.lat, building.long], {
            color: 'transparent',
            fillColor: 'transparent',
            fillOpacity: 0,
            radius: 50
        }).addTo(map);

        layer.on('mouseover', () => {
            layer.setStyle({
                color: 'white',
                fillColor: 'white',
                fillOpacity: 0.3
            });
            layer.bindTooltip(building.name, {
                permanent: false,
                direction: 'top',
                offset: L.point(0, -10)
            }).openTooltip();           
        });

        layer.on('mouseout', () => {
            layer.setStyle({
                color: 'transparent',
                fillColor: 'transparent',
                fillOpacity: 0
            });
            layer.unbindTooltip();
        });

        layer.on('click', async () => {
            map.setView([building.lat, building.long], 19);
            selectedBuilding = building;
            const time = viewByHour ? parseInt(document.getElementById('timebar').value) * 60 : document.getElementById('timebar').value;
            await updateHeatmapData(getDateInput());
            await updateBuildingStats(building.name, getDateInput(), formatTime(time));
        });

        buildingLayers.push(layer);
    });
}

async function updateHeatmapData(date = '2021-03-10') {
    const timebar = document.getElementById('timebar');
    const timeDisplay = document.getElementById('time-display');
    let selectedMinutes = parseInt(timebar.value, 10);
    let selectedHour = Math.floor(selectedMinutes / 60);
    let selectedMinute = selectedMinutes % 60;
    let timeString = `${String(selectedHour).padStart(2, '0')}:${String(selectedMinute).padStart(2, '0')}:00`;

    if (viewByHour) {
        selectedHour = selectedMinutes;
        selectedMinute = 0;
        selectedMinutes = selectedHour * 60;
        timeString = `${String(selectedHour).padStart(2, '0')}:00:00`;
    }

    timeDisplay.innerText = timeString;

    const formattedTime = formatTime(selectedMinutes);

    const occupancyData = selectedBuilding 
        ? await fetchBuildingPredictions(selectedBuilding.name, date, formattedTime)
        : await fetchCampusPredictions(date, formattedTime);

    if (!occupancyData) return;

    let filteredData = [];
    let totalCount = 0;

    if (selectedBuilding) {
        const buildingData = parseFloat(occupancyData[0]); // Ensure it's a number
        filteredData = [[selectedBuilding.lat, selectedBuilding.long, buildingData]];
        totalCount = buildingData;
    } else {
        filteredData = Object.keys(occupancyData).map(building => {
            const buildingData = parseFloat(occupancyData[building].predicted_occupancy[0]); // Ensure it's a number
            totalCount += buildingData; // Sum the predicted occupancies
            return [occupancyData[building].lat, occupancyData[building].long, buildingData];
        });
    }

    //console.log('Filtered data for heatmap:', filteredData);
    //console.log('Total predicted occupancy:', totalCount);

    updateHeatmap(filteredData);

    const counter = document.getElementById('occupancy-counter');
    if (!viewByHour) {
        counter.innerText = selectedBuilding
            ? `${selectedBuilding.name} predicted occupancy: ${totalCount.toFixed(2)* 10}`
            : `Campus predicted occupancy: ${totalCount.toFixed(2) * 10}`;
    } else if (!selectedBuilding) {
        counter.innerText = `Campus predicted occupancy: ${totalCount.toFixed(2)*10}`;
    } else {
        counter.innerText = '';
    }

    if (selectedBuilding) {
        const time = viewByHour ? selectedHour * 60 : selectedMinutes;
        await updateBuildingStats(selectedBuilding.name, date, formatTime(time));
    }
}



async function updatePredictedOccupancySum(date, formattedTime) {
    const occupancyData = await fetchCampusPredictions(date, formattedTime);

    if (!occupancyData) return;

    let totalCount = 0;

    totalCount = Object.keys(occupancyData).reduce((acc, building) => {
        return acc + occupancyData[building].predicted_occupancy[0];
    }, 0);

    const counter = document.getElementById('occupancy-counter');
    counter.innerText = `Campus predicted occupancy: ${parseFloat(totalCount).toFixed(2)}`;
}

/*

async function updateBuildingStats(building, date, time) {
    const buildingData = await fetchBuildingPredictions(building, date, time);
    if (!buildingData) return;

    let statsContainer = document.getElementById('building-stats-container');
    if (!statsContainer) {
        statsContainer = document.createElement('div');
        statsContainer.id = 'building-stats-container';
        statsContainer.style.position = 'absolute';
        statsContainer.style.right = '10px';
        statsContainer.style.top = '50px';
        statsContainer.style.zIndex = '1000';
        statsContainer.style.backgroundColor = 'rgba(255, 255, 255, 0.8)';
        statsContainer.style.padding = '10px';
        statsContainer.style.borderRadius = '5px';
        document.body.appendChild(statsContainer);
    }

    if (viewByHour) {
        statsContainer.innerHTML = `
            <strong>${building} Stats:</strong>
            <br>Predicted Hourly Occupancy: ${buildingData[0]}
        `;
    } else {
        statsContainer.innerHTML = `
            <strong>${building} Stats:</strong>
            <br>Predicted Current Occupancy: ${buildingData[0]}
        `;
    }
}

function clearBuildingStats() {
    const statsContainer = document.getElementById('building-stats-container');
    if (statsContainer) {
        statsContainer.innerHTML = '';
    }
}

*/

function updateHeatmap(data) {
    //console.log('Updating heatmap with data:', data); // Log data for debugging
    const enhancedData = data.map(point => [point[0], point[1], point[2] *10]);
    heat.setLatLngs(enhancedData);
}

function startAnimation() {
    if (intervalId) return;

    intervalId = setInterval(() => {
        const timebar = document.getElementById('timebar');
        timebar.value = viewByHour ? (parseInt(timebar.value, 10) + 1) % 24 : (parseInt(timebar.value, 10) + 1) % 1440;
        updateHeatmapData(getDateInput());
    }, 1000);
}

function stopAnimation() {
    clearInterval(intervalId);
    intervalId = null;
}

function debounce(func, wait) {
    let timeout;
    return function (...args) {
        clearTimeout(timeout);
        timeout = setTimeout(() => func.apply(this, args), wait);
    };
}

function formatTime(minutes) {
    const hours = String(Math.floor(minutes / 60)).padStart(2, '0');
    const mins = String(minutes % 60).padStart(2, '0');
    return `${hours}:${mins}`;
}

function handleDateInput() {
    const dateInput = document.getElementById('date-input').value;
    if (isValidDate(dateInput)) {
        updateHeatmapData(dateInput);
    } else {
        alert('Invalid date format. Using default date: 2021-03-10.');
        updateHeatmapData('2021-03-10');
    }
}

function isValidDate(dateString) {
    const regex = /^\d{4}-\d{2}-\d{2}$/;
    if (!dateString.match(regex)) return false;

    const date = new Date(dateString);
    const timestamp = date.getTime();

    if (typeof timestamp !== 'number' || Number.isNaN(timestamp)) return false;
    return date.toISOString().startsWith(dateString);
}

function getDateInput() {
    const dateInput = document.getElementById('date-input').value;
    return isValidDate(dateInput) ? dateInput : '2021-03-10';
}

