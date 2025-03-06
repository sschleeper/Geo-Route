// Geo-Routing Application
// This application calculates the nearest branch location for each US area code

// DOM elements
const branchFileInput = document.getElementById('branchFileInput');
const uploadBtn = document.getElementById('uploadBtn');
const uploadStatus = document.getElementById('uploadStatus');
const progressStatus = document.getElementById('progressStatus');
const downloadBtn = document.getElementById('downloadBtn');
const resultsBody = document.getElementById('resultsBody');
const debugInfo = document.getElementById('debugInfo');
const toggleDebugBtn = document.getElementById('toggleDebug');

// Global variables
let branchLocations = [];
let areaCodeToBranchMapping = [];
let isDebugMode = false;

// Debugging utility
function log(message, data = null) {
    const timestamp = new Date().toLocaleTimeString();
    let logMessage = `[${timestamp}] ${message}`;
    
    if (data) {
        if (typeof data === 'object') {
            logMessage += `: ${JSON.stringify(data, null, 2)}`;
        } else {
            logMessage += `: ${data}`;
        }
    }
    
    console.log(logMessage);
    
    if (debugInfo) {
        debugInfo.textContent += logMessage + '\n';
        // Auto-scroll to bottom
        debugInfo.scrollTop = debugInfo.scrollHeight;
    }
}

// Initialize the application
function init() {
    log('Initializing application');
    
    // Add event listeners
    uploadBtn.addEventListener('click', handleFileUpload);
    downloadBtn.addEventListener('click', downloadResults);
    toggleDebugBtn.addEventListener('click', toggleDebugMode);
    
    // Load area codes data (already available from areacodes.js)
    log(`Area codes data loaded: ${areaCodesData.length} records`);
    
    // Process area codes to add formatted version
    processAreaCodesData();
}

// Process area codes to add formatted version with +1 prefix
function processAreaCodesData() {
    log('Processing area codes data');
    
    // Add +1 prefix to area codes (matches the Python notebook logic)
    for (const areaCodeData of areaCodesData) {
        areaCodeData.push(`+1${areaCodeData[0]}`); // Add formatted area code as last element
    }
    
    log(`Area codes processed with +1 prefix added`);
}

// Handle file upload and processing
function handleFileUpload() {
    log('File upload initiated');
    
    const file = branchFileInput.files[0];
    if (!file) {
        showUploadStatus('Please select a CSV file to upload', 'error');
        return;
    }
    
    if (file.type !== 'text/csv' && !file.name.endsWith('.csv')) {
        showUploadStatus('Please upload a CSV file', 'error');
        return;
    }
    
    showUploadStatus('Reading file...', 'progress');
    
    const reader = new FileReader();
    
    reader.onload = function(e) {
        try {
            const csvContent = e.target.result;
            log(`CSV file loaded: ${file.name} (${csvContent.length} bytes)`);
            
            // Parse CSV to get branch locations
            branchLocations = parseCSV(csvContent);
            
            if (branchLocations.length === 0) {
                showUploadStatus('No valid branch locations found in the CSV', 'error');
                return;
            }
            
            log(`Parsed ${branchLocations.length} branch locations from CSV`);
            showUploadStatus(`Successfully loaded ${branchLocations.length} branch locations`, 'success');
            
            // Calculate nearest branches
            calculateNearestBranches();
            
        } catch (error) {
            log(`Error processing file: ${error.message}`, error);
            showUploadStatus(`Error processing file: ${error.message}`, 'error');
        }
    };
    
    reader.onerror = function() {
        log('Error reading file');
        showUploadStatus('Error reading file', 'error');
    };
    
    reader.readAsText(file);
}

// Parse CSV content - updated to handle Gen Rent specific CSV format
function parseCSV(csvContent) {
    log('Parsing CSV content');
    
    // Split by lines and remove empty lines
    const lines = csvContent.split(/\r\n|\n|\r/).filter(line => line.trim().length > 0);
    
    if (lines.length < 2) {
        throw new Error('CSV file must contain a header row and at least one data row');
    }
    
    log(`CSV has ${lines.length} rows (including header)`);
    
    // Parse header row
    const header = parseCSVLine(lines[0]);
    log(`CSV header: ${header.join(', ')}`);
    
    // Find required column indices - focusing on the specific fields needed
    const branchNameIndex = findColumnIndex(header, ['branch name', 'branchname', 'branch', 'name']);
    const branchCodeIndex = findColumnIndex(header, ['branch code', 'branchcode', 'code']);
    const addressIndex = findColumnIndex(header, ['address', 'street', 'location']);
    const cityIndex = findColumnIndex(header, ['city', 'town']);
    const stateIndex = findColumnIndex(header, ['state', 'province']);
    const latitudeIndex = findColumnIndex(header, ['latitude', 'lat']);
    const longitudeIndex = findColumnIndex(header, ['longitude', 'lng', 'long', 'lon']);
    
    // Log the identified column indices
    log(`Column indices found - Branch Name: ${branchNameIndex}, Branch Code: ${branchCodeIndex}, Address: ${addressIndex}, City: ${cityIndex}, State: ${stateIndex}, Latitude: ${latitudeIndex}, Longitude: ${longitudeIndex}`);
    
    // Validate that required columns were found
    if (branchNameIndex === -1 || latitudeIndex === -1 || longitudeIndex === -1) {
        const missingColumns = [];
        if (branchNameIndex === -1) missingColumns.push('Branch Name');
        if (latitudeIndex === -1) missingColumns.push('Latitude');
        if (longitudeIndex === -1) missingColumns.push('Longitude');
        
        throw new Error(`Missing required columns: ${missingColumns.join(', ')}`);
    }
    
    // Parse data rows
    const branches = [];
    
    for (let i = 1; i < lines.length; i++) {
        try {
            const values = parseCSVLine(lines[i]);
            
            // Skip rows that don't have enough columns for required fields
            if (values.length <= Math.max(branchNameIndex, latitudeIndex, longitudeIndex)) {
                log(`Skipping row ${i+1}: insufficient columns`, values);
                continue;
            }
            
            // Extract required fields
            const branchName = values[branchNameIndex].trim();
            const latitudeStr = values[latitudeIndex].trim();
            const longitudeStr = values[longitudeIndex].trim();
            
            // Extract optional fields (if available)
            const branchCode = branchCodeIndex >= 0 && branchCodeIndex < values.length ? values[branchCodeIndex].trim() : '';
            const address = addressIndex >= 0 && addressIndex < values.length ? values[addressIndex].trim() : '';
            const city = cityIndex >= 0 && cityIndex < values.length ? values[cityIndex].trim() : '';
            const state = stateIndex >= 0 && stateIndex < values.length ? values[stateIndex].trim() : '';
            
            // Skip rows with empty branch name
            if (!branchName) {
                log(`Skipping row ${i+1}: empty branch name`, values);
                continue;
            }
            
            // Convert latitude and longitude to numbers
            let latitude = parseFloat(latitudeStr);
            let longitude = parseFloat(longitudeStr);
            
            // Handle case where lat/long might be a string like "31.721254, -106.318497"
            if (isNaN(latitude) || isNaN(longitude)) {
                // Try to parse as comma-separated lat/long
                const latLongMatch = latitudeStr.match(/(-?\d+\.\d+),\s*(-?\d+\.\d+)/);
                if (latLongMatch) {
                    latitude = parseFloat(latLongMatch[1]);
                    longitude = parseFloat(latLongMatch[2]);
                } else {
                    log(`Skipping row ${i+1}: invalid coordinates`, { latitude: latitudeStr, longitude: longitudeStr });
                    continue;
                }
            }
            
            // Validate latitude and longitude
            if (isNaN(latitude) || isNaN(longitude)) {
                log(`Skipping row ${i+1}: invalid coordinates`, { latitude: latitudeStr, longitude: longitudeStr });
                continue;
            }
            
            // Create branch object with all available fields
            const branch = {
                name: branchName,
                code: branchCode,
                address: address,
                city: city,
                state: state,
                latitude: latitude,
                longitude: longitude
            };
            
            branches.push(branch);
            
            // Log the first few branches for debugging
            if (i <= 3) {
                log(`Sample branch ${i}: ${branchName}`, branch);
            }
            
        } catch (error) {
            log(`Error parsing row ${i+1}: ${error.message}`);
            // Continue to next row on error
        }
    }
    
    log(`Successfully parsed ${branches.length} branch locations`);
    return branches;
}

// Parse a single CSV line, handling quoted fields correctly
function parseCSVLine(line) {
    const result = [];
    let currentValue = '';
    let insideQuotes = false;
    
    for (let i = 0; i < line.length; i++) {
        const char = line[i];
        const nextChar = line[i + 1];
        
        if (char === '"') {
            if (insideQuotes && nextChar === '"') {
                // Escaped quote inside quotes
                currentValue += '"';
                i++;
            } else {
                // Toggle quote mode
                insideQuotes = !insideQuotes;
            }
        } else if (char === ',' && !insideQuotes) {
            // End of field
            result.push(currentValue);
            currentValue = '';
        } else {
            // Normal character
            currentValue += char;
        }
    }
    
    // Push the last value
    result.push(currentValue);
    
    return result;
}

// Find column index by name (case-insensitive and allowing multiple possible names)
function findColumnIndex(header, possibleNames) {
    for (let i = 0; i < header.length; i++) {
        const columnName = header[i].toLowerCase().trim();
        if (possibleNames.includes(columnName)) {
            return i;
        }
    }
    
    // Try partial matches
    for (let i = 0; i < header.length; i++) {
        const columnName = header[i].toLowerCase().trim();
        for (const possibleName of possibleNames) {
            if (columnName.includes(possibleName)) {
                return i;
            }
        }
    }
    
    return -1;
}

// Calculate distance between two points using Haversine formula
function calculateDistance(lat1, lon1, lat2, lon2) {
    const R = 3958.8; // Earth's radius in miles
    const dLat = toRadians(lat2 - lat1);
    const dLon = toRadians(lon2 - lon1);
    
    const a = 
        Math.sin(dLat/2) * Math.sin(dLat/2) +
        Math.cos(toRadians(lat1)) * Math.cos(toRadians(lat2)) * 
        Math.sin(dLon/2) * Math.sin(dLon/2);
    
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
    const distance = R * c;
    
    return distance;
}

// Convert degrees to radians
function toRadians(degrees) {
    return degrees * Math.PI / 180;
}

// Calculate nearest branch for each area code
function calculateNearestBranches() {
    log('Calculating nearest branches for area codes');
    
    if (branchLocations.length === 0) {
        log('No branch locations available');
        return;
    }
    
    progressStatus.textContent = 'Calculating nearest branches...';
    
    // Use setTimeout to prevent UI freezing for large datasets
    setTimeout(() => {
        try {
            // Clear previous results
            areaCodeToBranchMapping = [];
            
            // Process area codes in batches for better UI responsiveness
            const batchSize = 100;
            let currentIndex = 0;
            
            // Process fixed number of area codes at a time
            function processNextBatch() {
                let counter = 0;
                while (currentIndex < areaCodesData.length && counter < batchSize) {
                    const areaCodeEntry = areaCodesData[currentIndex];
                    const areaCode = areaCodeEntry[0];
                    const areaLat = areaCodeEntry[4];
                    const areaLng = areaCodeEntry[5];
                    const formattedAreaCode = areaCodeEntry[6]; // +1 prefixed area code
                    
                    // Find nearest branch
                    let minDistance = Infinity;
                    let nearestBranch = null;
                    let nearestBranchCode = null;
                    
                    for (const branch of branchLocations) {
                        const distance = calculateDistance(areaLat, areaLng, branch.latitude, branch.longitude);
                        if (distance < minDistance) {
                            minDistance = distance;
                            nearestBranch = branch.name;
                            nearestBranchCode = branch.code || '';
                        }
                    }
                    
                    if (nearestBranch) {
                        const mappingEntry = {
                            areaCode: formattedAreaCode,
                            nearestBranch: nearestBranch,
                            nearestBranchCode: nearestBranchCode,
                            distance: minDistance.toFixed(2)
                        };
                        
                        areaCodeToBranchMapping.push(mappingEntry);
                    }
                    
                    currentIndex++;
                    counter++;
                }
                
                // Update progress
                progressStatus.textContent = `Processed ${currentIndex} of ${areaCodesData.length} area codes...`;
                
                // Continue with next batch or finish
                if (currentIndex < areaCodesData.length) {
                    setTimeout(processNextBatch, 0);
                } else {
                    finishCalculation();
                }
            }
            
            // Start processing
            processNextBatch();
        } catch (error) {
            log(`Error calculating nearest branches: ${error.message}`, error);
            progressStatus.textContent = `Error: ${error.message}`;
        }
    }, 100);
}

// Finish calculation and display results
function finishCalculation() {
    log(`Calculation complete. Matched ${areaCodeToBranchMapping.length} area codes to branches`);
    
    // Remove duplicates (keep the first occurrence of each area code)
    const uniqueMapping = [];
    const seenAreaCodes = new Set();
    
    for (const mapping of areaCodeToBranchMapping) {
        if (!seenAreaCodes.has(mapping.areaCode)) {
            uniqueMapping.push(mapping);
            seenAreaCodes.add(mapping.areaCode);
        }
    }
    
    // Update global mapping with de-duplicated results
    areaCodeToBranchMapping = uniqueMapping;
    
    log(`After removing duplicates: ${areaCodeToBranchMapping.length} unique area codes`);
    progressStatus.textContent = `Matched ${areaCodeToBranchMapping.length} area codes to nearest branches`;
    
    // Display results
    displayResults();
    
    // Enable download button
    downloadBtn.disabled = false;
}

// Display results in the table
function displayResults() {
    log('Displaying results in table');
    
    // Clear previous results
    resultsBody.innerHTML = '';
    
    // Sort by area code
    areaCodeToBranchMapping.sort((a, b) => a.areaCode.localeCompare(b.areaCode));
    
    // Display the first 100 results (for performance)
    const displayLimit = 100;
    const displayCount = Math.min(displayLimit, areaCodeToBranchMapping.length);
    
    for (let i = 0; i < displayCount; i++) {
        const mapping = areaCodeToBranchMapping[i];
        
        const row = document.createElement('tr');
        
        const areaCodeCell = document.createElement('td');
        areaCodeCell.textContent = mapping.areaCode;
        row.appendChild(areaCodeCell);
        
        const branchCell = document.createElement('td');
        if (mapping.nearestBranchCode) {
            branchCell.textContent = `${mapping.nearestBranch} (${mapping.nearestBranchCode})`;
        } else {
            branchCell.textContent = mapping.nearestBranch;
        }
        row.appendChild(branchCell);
        
        const distanceCell = document.createElement('td');
        distanceCell.textContent = mapping.distance;
        row.appendChild(distanceCell);
        
        resultsBody.appendChild(row);
    }
    
    // Add message if there are more results
    if (areaCodeToBranchMapping.length > displayLimit) {
        const messageRow = document.createElement('tr');
        const messageCell = document.createElement('td');
        messageCell.colSpan = 3;
        messageCell.textContent = `Showing ${displayCount} of ${areaCodeToBranchMapping.length} results. Download the CSV to see all results.`;
        messageCell.style.fontStyle = 'italic';
        messageCell.style.textAlign = 'center';
        messageRow.appendChild(messageCell);
        resultsBody.appendChild(messageRow);
    }
}

// Download results as CSV
function downloadResults() {
    log('Downloading results as CSV');
    
    if (areaCodeToBranchMapping.length === 0) {
        log('No results to download');
        return;
    }
    
    // Create CSV content
    let csvContent = 'Area Code,Nearest Branch,Branch Code,Distance (miles)\n';
    
    for (const mapping of areaCodeToBranchMapping) {
        // Handle fields that may contain commas
        const formattedBranch = mapping.nearestBranch.includes(',') ? 
            `"${mapping.nearestBranch}"` : mapping.nearestBranch;
        
        csvContent += `${mapping.areaCode},${formattedBranch},${mapping.nearestBranchCode || ''},${mapping.distance}\n`;
    }
    
    // Create download link
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.setAttribute('href', url);
    link.setAttribute('download', 'area_code_to_branch_mapping.csv');
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    
    log('Download initiated');
}

// Show upload status message
function showUploadStatus(message, type) {
    log(`Upload status: ${message} (${type})`);
    
    uploadStatus.textContent = message;
    uploadStatus.className = 'status';
    
    if (type === 'error') {
        uploadStatus.classList.add('error');
    } else if (type === 'success') {
        uploadStatus.classList.add('success');
    } else if (type === 'progress') {
        uploadStatus.classList.add('progress');
    }
}

// Toggle debug mode
function toggleDebugMode() {
    isDebugMode = !isDebugMode;
    
    if (isDebugMode) {
        debugInfo.style.display = 'block';
        toggleDebugBtn.textContent = 'Hide Debug Info';
    } else {
        debugInfo.style.display = 'none';
        toggleDebugBtn.textContent = 'Show Debug Info';
    }
}

// Initialize the application when the DOM is fully loaded
document.addEventListener('DOMContentLoaded', init); 