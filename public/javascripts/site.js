var socket = io.connect("/");
var changes = document.querySelector('#changes');

socket.on("message", function (data) {
  console.log("Message received: " + data);
  //test if client received message
  if(data == 'Successfully connected.'){
    socket.emit('message received', 'Yeah, I got your message');
  }
});

function generateGrid() {
  var container = document.createElement("div");
  container.setAttribute("class", "grid-container");
  changes.appendChild(container);
  return container;
}

function generateCells(text) {
  var item = document.createElement("div");
  item.setAttribute("class", "grid-item");
  var textNode = document.createTextNode(text);
  item.appendChild(textNode);
  return item;
}

socket.on("diffed changes", function(data) {
  console.log(`This are the diffed changes: ${data}`);
  var container = generateGrid();
  //generate grid header
  container.appendChild(generateCells("Location"));
  container.appendChild(generateCells("Temperature / °F"));
  container.appendChild(generateCells("Temperature Differences Compared to Yesterday"));
  //parse data from backend
  var changes = JSON.parse(data);
  for (const [state, locations] of Object.entries(changes)) {
    for (const [location, values] of Object.entries(locations)) {
      container.appendChild(generateCells(location));
      container.appendChild(generateCells(values['temp']));
      container.appendChild(generateCells(values['diff']));
    }
  }
});

if ('serviceWorker' in navigator) {
  navigator.serviceWorker.register('sw.js')
    .then(function(registration) {
      console.log(`Successfully registered service worker to ${registration.scope}`);
      // logic to handle notification subscriptions goes here...
      if ('Notification' in window) {
        var notify_me_button = document.createElement('button');
        notify_me_button.id = "notify-me";
        notify_me_button.innerText = 'Send me Notifications';
        notify_me_button.addEventListener('click', function(event) {
          Notification.requestPermission()
            .then(function(permission) {
              console.log("Permission: ", permission);
              if (permission == 'granted') {
                  // fetch the public VAPID key
                  fetch('/subscription/public-key/')
                  .then(function(response) {
                    console.log('Raw fetch response:', response);
                    return response.json();
                  })
                  .then(function(data) {
                    console.log('Fetch response data: ', data);
                    var options = {
                      userVisibleOnly: true,
                      applicationServerKey:  urlBase64ToUint8Array(data.vapid_public_key)
                    };
                    registration.pushManager.subscribe(options)
                      .then(function(subscription) {
                        // diagnostic of the subscription object returned by subscribe():
                        console.log(JSON.stringify(subscription));
                        // Logic here to then save the subscription by calling fetch('/subscription', ...);
                        fetch('/subscription/',
                          { method: 'POST',
                            headers: { 'Content-Type': 'application/json' },
                            body: JSON.stringify(subscription) })
                          .then(function(response) { return response.json(); })
                          .then(function(response) { console.log(response); })
                          .catch(function(error) {
                            console.error('Error: ', error);
                          });
                        })
                        .catch(function(error) {
                          console.error('Subscription error: ', error);
                        }); // end subscription
                  })
                  .catch(function(error) {
                    console.error('Fetch error: ', error);
                  }); //
              } // if permission granted
            })
            .catch(function(error) {
              console.error('Permission error:', error);
            });
        });
        document.querySelector('body').append(notify_me_button);
      }

    })
    .catch(function(error) {
      console.error('Could not register service worker', error);
    });
}

function urlBase64ToUint8Array(base64String) {
  const padding = '='.repeat((4 - base64String.length % 4) % 4);
  const base64 = (base64String + padding)
    .replace(/-/g, '+')
    .replace(/_/g, '/');

  const rawData = window.atob(base64);
  const outputArray = new Uint8Array(rawData.length);

  for (let i = 0; i < rawData.length; ++i) {
    outputArray[i] = rawData.charCodeAt(i);
  }
  return outputArray;
}
