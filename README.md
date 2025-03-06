# Gen Rent Geo-Routing Tool

A browser-based application for matching US area codes to the nearest Gen Rent branch location based on geographical distance.

## Overview

This tool helps route phone calls to the appropriate Gen Rent branch by determining which branch is geographically closest to each US area code. It uses a pre-loaded database of US area codes with their geographic coordinates and allows you to upload your own list of Gen Rent branch locations.

## Features

- Pre-loaded database of US area codes with geographic coordinates
- Upload your branch locations via CSV file
- Automatic calculation of the nearest branch for each area code
- Results displayed in a sortable table
- Download results as a CSV file
- Debug mode for troubleshooting

## How to Use

1. **Open the Application**: Open `index.html` in a web browser.

2. **Prepare Your Branch Locations CSV**:
   - Create a CSV file with your branch location data
   - Required columns: Branch Name, Latitude, and Longitude
   - Example format:
     ```
     Branch Name,Latitude,Longitude
     Downtown,40.7128,-74.0060
     Westside,34.0522,-118.2437
     ```

3. **Upload Branch Locations**:
   - Click the "Choose File" button
   - Select your branch locations CSV file
   - Click the "Upload and Process" button

4. **View Results**:
   - The application will calculate the nearest branch for each area code
   - Results will be displayed in the table below
   - For performance reasons, only the first 100 results are shown in the table

5. **Download Complete Results**:
   - Click the "Download Results" button to save a CSV file with all area code to branch mappings

## CSV File Format

The branch locations CSV file should have the following structure:

- Must include a header row
- Must include columns for Branch Name, Latitude, and Longitude
- The application will attempt to find these columns even if they have slightly different names
- Latitude and longitude should be in decimal degrees (e.g., 40.7128, -74.0060)

## Troubleshooting

If you encounter issues:

1. Check the CSV file format (headers and data)
2. Enable debug mode by clicking "Show Debug Info" to see detailed logs
3. Ensure latitude and longitude values are valid numbers
4. Verify that your CSV file has the required columns

## Technical Details

- This is a client-side application that runs entirely in your browser
- No data is sent to any server
- Uses the Haversine formula to calculate distances between geographic coordinates
- Processes area codes in batches to maintain UI responsiveness
- Handles large datasets efficiently

## Files

- `index.html`: The main HTML file with the user interface
- `app.js`: The main JavaScript application
- `areacodes.js`: Contains the database of US area codes with coordinates 