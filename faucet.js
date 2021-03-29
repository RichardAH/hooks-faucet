const express = require('express')
const app = express()
const process = require('process')
const RippleAPI = require('ripple-lib').RippleAPI;
const fs = require('fs');

const faucet_secret = JSON.parse(fs.readFileSync('/root/testnet-keys.json'))['daddy']['secret']
if (!faucet_secret)
    return console.log("could not load rDaddy secret from testnet-keys.json");

const header = `
<html><head>
<link rel="preconnect" href="https://fonts.gstatic.com">
<link href="https://fonts.googleapis.com/css2?family=Cutive+Mono&display=swap" rel="stylesheet">
<style>
body {
    font-family: 'Cutive Mono', monospace;
    margin: 2em;
    background: black;
    color: white;
}
.label {
    font-weight:bold;
    min-width:7em;
    color: lime;
    display: inline-block;
  -webkit-touch-callout: none; /* iOS Safari */
    -webkit-user-select: none; /* Safari */
     -khtml-user-select: none; /* Konqueror HTML */
       -moz-user-select: none; /* Old versions of Firefox */
        -ms-user-select: none; /* Internet Explorer/Edge */
            user-select: none; /* Non-prefixed version, currently
                                  supported by Chrome, Edge, Opera and Firefox */
    text-transform: capitalize;
    font-weight: bolder;
}
#credinternal { margin-top: 2em; padding: 1em; border: 1px solid white;};
</style>
</head><body>
`;

let last_req = {};

app.post('/newcreds', function(req, res) {
    let ip = req.headers['cf-connecting-ip'];
    let now = Date.now()/1000
    if (last_req[ip] !== undefined)
    {
        let time_passed = now - last_req[ip];
        if (time_passed < 30)
        return res.send(JSON.stringify({
            "error": 'you must wait ' + Math.ceil( 30 - time_passed ) + ' seconds before requesting again'
        }));
    }
    last_req[ip] = Date.now()/1000;

    const api = new RippleAPI({
        server: 'ws://localhost:6006'
    });

    let addr = api.generateAddress();

    ((addr)=>{
        api.on('error', (errorCode, errorMessage) => {
            return res.send(JSON.stringify({error: "could not connect to rippled"}));
        });
        api.connect().then(() => {
            j = {
                Account: 'rDADDYfnLvVY9FBnS8zFXhwYFHPuU5q2Sk',
                TransactionType: "Payment",
                Amount: "10000000000",
                Destination: addr.classicAddress,
                Fee: "100000"
            }

            api.prepareTransaction(j).then( (x)=>
            {
                s = api.sign(x.txJSON, faucet_secret)
                console.log(s)
                api.submit(s.signedTransaction).then( response =>
                {
                    console.log(response.resultCode, response.resultMessage)
                    console.log("Done!")
                    return res.send(JSON.stringify({
                        address: addr.classicAddress,
                        secret: addr.secret,
                        xrp: 10000,
                        hash: s.id,
                        code: response.resultCode
                    }));
                }).catch ( e=> {
                    return res.send(JSON.stringify({error: "could not submit to rippled"}));
                });
             });
        }).then(() => {
        }).catch(e=> {
                return res.send(JSON.stringify({error: "could not connect to rippled"}));
        });

    })(addr);
});

app.get('/faucet', function (req, res) {
  res.send(header + `
      <h2>Hooks Testnet Faucet</h2>
      <button onclick="generate()">New Credentials</button>
      <div id="cred">
      </div>
      <script defer>
        function reqListener () {
            console.log(this.responseText);
            let creds = JSON.parse(this.responseText);
            let out = '<div id="credinternal">';
            for (x in creds)
            {
                out += '<div><div class="label" class="noselect">' + x + ' </div>';
                out += creds[x];
                out += '</div>';
            }
            document.getElementById('cred').innerHTML = out + "</div>";
        }

        function generate() {
            var oReq = new XMLHttpRequest();
            oReq.addEventListener("load", reqListener);
            oReq.open("POST", "/newcreds");
            oReq.send();
        }
      </script>

  `);
})

app.listen(80)
