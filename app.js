"use strict";

const createError = require("http-errors");
const express = require("express");
const path = require("path");
const cookieParser = require("cookie-parser");
const logger = require("morgan");
const io = require("socket.io")();
const fs = require("fs");
const diff = require("diff");
const {EventEmitter} = require('events');
const axios = require('axios');
const cheerio = require('cheerio');
const schedule = require('node-schedule');

const indexRouter = require("./routes/index");
const subscriptionRouter = require('./routes/subscription');
const webPush = require('web-push')

const app = express();


var old_file = fs.readFileSync('./var/weatherData.json', {encoding:"utf8"});
var fileEvent = new EventEmitter();

//Diff testing locally
fs.watch('./var/weatherData.json', function(eventType, filename){
  fs.promises.readFile(`./var/${filename}`,{encoding:"utf8"})
  .then(function(data) {
    var new_file = data;
    const vapid_keys = {
        public: 'BMJ9IpyHYOZIPP4fkxbmu_rd3CD95Bw_ehAJc8KSyvR04QWU78xHOw9A0e07OYwPA4bO2SjF_BT0Z1xYViLSZbI',
        private: 'uhONt3RMY8ooDWp1vZ15_aWojSCcbumeJ27FaTx5tlM',
    };
    webPush.setVapidDetails(
        'mailto:lizamyshenyova@gmail.com',
        vapid_keys.public,
        vapid_keys.private
    );

    fs.promises.readFile(`var/subscription.json`, {encoding:"utf8"})
        .then(function(subs) {
          let subscription = subs.split('\n');
          subscription.map(function(subscription) {
            if (subscription.length > 5) {
              subscription = JSON.parse(subscription);
              console.log('Subscription to send to:', subscription);
              console.log('Message to send:', new_file);

                webPush.sendNotification(subscription, 'The weather report has changed')
           .catch(function(error) {
                console.error('sendNotification error: ', error, subscription, new_file);
            });


        }
      });
    })
    .catch(function(error) {
         console.error('Error: ', error);
    });


    if (new_file !== old_file)
    {
      console.log("Here?");
      console.log(`The content of ${filename} has changed. It was a ${eventType} event.`);
      var file_changes = diff.diffLines(old_file, new_file);
      var new_changes = file_changes.map((change, i) => {
        if (change.added){
          return `<li class="ins">${change.value}</li>`;
        }
        if (change.removed){
          return `<li class="del">${change.value}</li>`;
        }
      });
      fileEvent.emit('changed file', new_changes.join('\n'));
    }
    old_file = new_file

  });
});

//a function that handles axios request for weather data
function requestData() {
  //requesting html from the webpage
  axios.get('https://www.weather.gov/ilx/maxtemp')
    .then((res) => {
      if (res.status === 200){
        const html = res.data;
        //load html into cheerio
        const $ = cheerio.load(html);
        //loading weather infomation
        const weatherInfo = $('pre');
        const output = weatherInfo.html();
        //parsing html data
        var lines = output.split("\n").filter(line => line.length > 2);
        var json = {};
        var state = "";
        json['title'] = lines.slice(0, 3).join(" ");
        json['data'] = {};
        lines.slice(3).forEach(line => {
          var arr = line.split(" ").filter(word => word != '');
          if(isNaN(arr[arr.length-1])) {
            //state
            state = arr.join(" ");
            json['data'][state] = {};
            console.log(json['data']);
          } else {
            //location
            var location = arr.slice(0,arr.length-1).join(" ");
            json['data'][state][location] = arr[arr.length-1];
          }
        });
        //convert object to a json string
        console.log("Testing here:");
        var weatherData = JSON.stringify(json);
        fs.writeFile('./var/weatherData.json', weatherData, (error) => {
            if (error) throw err;
            console.log('Data written to json file');
        });
        fs.writeFile('./var/file.txt', output, error => {
          //In case of error throw err exception
          if (error) throw err;
        });
      }
    })
    .catch((error) => {
      console.log('Fail to fetch', error);
    })
}

// view engine setup
app.set("views", path.join(__dirname, "views"));
app.set("view engine", "pug");

app.use(logger("dev"));
app.use(express.json());
app.use(express.urlencoded({ extended: false }));
app.use(cookieParser());
app.use(express.static(path.join(__dirname, "public")));

app.use("/", indexRouter);
app.use("/subscription", subscriptionRouter)

// send a message on successful socket connection
io.on('connection', function(socket){
  socket.emit('message', 'Successfully connected.');
  //test if client receives data
  socket.on('message received', function(data){
    console.log('Client is saying:' + data)
  })
  //when `changed file` event fires, send changes to browser
  fileEvent.on('changed file', function(data){
    socket.emit('diffed changes', data);
  });

  //request weather data initially
  requestData();

  //rRequest weather data every 10 minutes
  var scheduleTask = schedule.scheduleJob('*/10 * * * *', function(){
    requestData();
  });
});




// catch 404 and forward to error handler
app.use(function (req, res, next) {
  next(createError(404));
});

// error handler
app.use(function (err, req, res, next) {
  // set locals, only providing error in development
  res.locals.message = err.message;
  res.locals.error = req.app.get("env") === "development" ? err : {};

  // render the error page
  res.status(err.status || 500);
  res.render("error");
});

module.exports = { app, io };
