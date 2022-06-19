/**
 * @license
 * Copyright 2020 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

/**
 * @fileoverview Default entry point for App Engine Node.js runtime. Defines a
 * web service which returns the mapid to be used by clients to display map
 * tiles showing slope computed in real time from SRTM DEM data. See
 * accompanying README file for instructions on how to set up authentication.
 */
const ee = require('@google/earthengine');
const express = require('express');
const privateKey = require('./key.json');
const port = process.env.PORT || 3000;

var bodyParser = require("body-parser");
var app = express();
app.use(bodyParser.json());




// Define endpoint at /mapid.
app.post('/ndvi', (request, response) => {

  // [[45.656041319941686, 38.46328323263824],
  //       [45.76178472814481, 38.36751838038664],
  //       [45.92932623205106, 38.428865541555176],
  //       [45.798863585566686, 38.48586092130292],
  //       [45.71509283361356, 38.49123551928738]]

    var geometry = ee.Geometry.Polygon([request.body.cords]);
  
    var farm=geometry;

    //calculate area of polygon
    var stateArea = farm.area()
    // console.log('Farm Area(m^2) : ',(stateArea.getInfo())/10000);


    const maskS2clouds = (image)=> {
      var qa = image.select('QA60');

      // Bits 10 and 11 are clouds and cirrus, respectively.
      var cloudBitMask = 1 << 10;
      var cirrusBitMask = 1 << 11;

      // Both flags should be set to zero, indicating clear conditions.
      var mask = qa.bitwiseAnd(cloudBitMask).eq(0)
          .and(qa.bitwiseAnd(cirrusBitMask).eq(0));

      return image.updateMask(mask).divide(10000);
    }

    //data selection
    var image=ee.ImageCollection("COPERNICUS/S2_SR")
      .filterBounds(farm)
      .filterDate('2021-04-20','2021-05-20')
      .filter(ee.Filter.lessThan('CLOUDY_PIXEL_PERCENTAGE',20))
      .map(maskS2clouds)
      .median()
      .clip(farm);

    var vis = {
      min: 0.0,
      max: 0.3,
      bands: ['B4', 'B3', 'B2'],
    };

    // Map.addLayer(image,vis);
    // print('Image property : ',image)

    //var nir=image.select(["B8"]);
    //var red=image.select(["B4"]);
    var visParams = {min: -1, max: 1, palette: ['blue', 'red','green']};


    //NDVI computation
    var ndvi = image.normalizedDifference(["B8", "B4"]).rename('NDVI');

    var outImg = ndvi.visualize(visParams)
    // console.log(outImg.getThumbURL({region: geometry,scale: 1, format: 'png'}));

    // console.log(
    //   outImg.getThumbURL({region: geometry,scale: 8, format: 'png'})
      // outImg.getDownloadURL({
      //   name: 'custom_single_band',
      //   scale:8,
      //   region: geometry,
      //   format: 'GEO_TIFF'
      // })
    // );

    let imgUrl = outImg.getThumbURL({region: geometry,scale: 8, format: 'png'});

    var responseObj = {
      areas:stateArea.getInfo(),
      imgUrl:imgUrl ,
      infos:ndvi.getInfo()
    }


    response.send(responseObj);


    // Display the result.
    // Map.addLayer(ndvi, visParams, 'NDVI image');



  // var geometry = 
  //   /* color: #d63000 */
  //   /* shown: false */
  //   ee.Geometry.Polygon(
  //       [[[47.70972627358627, 38.48388053961585],
  //         [47.70890015320968, 38.48364538533996],
  //         [47.710573851634976, 38.48086546771963],
  //         [47.711346327831265, 38.48145337464549]]]);

  // console.log(geometry.area().getInfo());

//   var outImg = img.visualize(visualization)
// Map.addLayer(outImg)

// print(outImg.getThumbURL({region: pngArea,scale: 200, format: 'png'}))

});



console.log('Authenticating Earth Engine API using private key...');

ee.data.authenticateViaPrivateKey(
    privateKey,
    () => {
      console.log('Authentication successful.');
      ee.initialize(
          null, null,
          () => {
            console.log('Earth Engine client library initialized.');
            app.listen(port);


            console.log(`Listening on port ${port}`);
          },
          (err) => {
            console.log(err);
            console.log(
                `Please make sure you have created a service account and have been approved.
Visit https://developers.google.com/earth-engine/service_account#how-do-i-create-a-service-account to learn more.`);
          });
    },
    (err) => {
      console.log(err);
    });
