document.getElementById('filterContractAction').addEventListener('change', function () {
    var contractActionFields = document.getElementById('contractActionFields');
    if (this.checked) {
        contractActionFields.style.display = 'block';
    } else {
        contractActionFields.style.display = 'none';
    }
});

function fetchData(url, skip, formattedData, resolve, reject) {
    if (skip === 0) {
        formattedData = []; // Reset formattedData for the first request
    }

    fetch(url + '&skip=' + (skip * 1000))
        .then(response => response.json())
        .then(data => {
            formattedData = formattedData.concat(
                data.actions.map(function (action) {
                    return {
                        Date: action.timestamp,
                        Sender: action.act.data.from,
                        Recipient: action.act.data.to,
                        Quantity: action.act.data.quantity,
                        Memo: action.act.data.memo,
                        'Transaction ID': action.trx_id,
                    };
                })
            );

            if (data.actions.length === 1000) {
                // If the response has 1000 actions, fetch again with incremented skip
                fetchData(url, skip + 1, formattedData, resolve, reject);
            } else {
                // All data received, resolve the promise
                resolve(formattedData);
            }
        })
        .catch(error => {
            reject(error);
        });
}

document.getElementById('accountContractForm').addEventListener('submit', function (event) {
    event.preventDefault();

    var beforedateInput = document.getElementById('beforedate');
    var afterdateInput = document.getElementById('afterdate');

    var beforedate = beforedateInput.value
        ? new Date(beforedateInput.value).toISOString().split('T')[0] + 'T00:00:00Z'
        : '';
    var afterdate = afterdateInput.value
        ? new Date(afterdateInput.value).toISOString().split('T')[0] + 'T00:00:00Z'
        : '';

    if (afterdate && beforedate && afterdate >= beforedate) {
        alert('Error: "After Date" must be earlier than "Before Date".');
        return;
    }

    var jsonDataDiv = document.getElementById('jsonData');
    jsonDataDiv.style.display = 'none'; // Hide the JSON data initially

    var network = document.getElementById('network').value;
    var account = document.getElementById('account').value;
    var contract = '';
    var action = '';

    if (document.getElementById('filterContractAction').checked) {
        contract = document.getElementById('contract').value;
        action = document.getElementById('action').value;
    }

    var url =
        network +
        '/v2/history/get_actions?limit=1000&account=' +
        account +
        '&after=' +
        afterdate +
        '&before=' +
        beforedate;

    if (contract && action) {
        url += '&filter=' + contract + '%3A' + action;
    }
    console.log('API URL:', url); // Log the URL in the console

    document.getElementById('result').innerHTML = 'API URL: ' + url;

    new Promise(function (resolve, reject) {
        fetchData(url, 0, [], resolve, reject);
    })
    .then(function (formattedData) {
        var sentAmounts = {};
        var receivedAmounts = {};
        var earliestDate = null;
        var latestDate = null;

        formattedData.forEach(function (action) {
            var date = new Date(action.Date);
            if (!earliestDate || date < earliestDate) {
                earliestDate = date;
            }
            if (!latestDate || date > latestDate) {
                latestDate = date;
            }

            // Check if the quantity is present and valid
            if (action.Quantity) {
                var quantity = parseFloat(action.Quantity.split(' ')[0]);
                var symbol = action.Quantity.split(' ')[1];

                if (!isNaN(quantity) && symbol && /^[A-Za-z]+$/.test(symbol)) {
                    if (action.Sender === account) {
                        if (!sentAmounts[symbol]) {
                            sentAmounts[symbol] = 0;
                        }
                        sentAmounts[symbol] += quantity;
                    } else if (action.Recipient === account) {
                        if (!receivedAmounts[symbol]) {
                            receivedAmounts[symbol] = 0;
                        }
                        receivedAmounts[symbol] += quantity;
                    }
                }
            }
        });

        var totalTransactions = formattedData.length; // Count of total transactions
        document.getElementById('result').innerHTML =
            'API URL: ' +
            url +
            '<br>Total Transactions: ' +
            totalTransactions +
            '<br>';

        // Display sent amounts
        document.getElementById('result').innerHTML +=
            '<br>Sent Amounts:<br>' +
            JSON.stringify(sentAmounts, null, 4);

        // Display received amounts
        document.getElementById('result').innerHTML +=
            '<br>Received Amounts:<br>' +
            JSON.stringify(receivedAmounts, null, 4);

        // Enable the "Download CSV" button after successful submit
        document.getElementById('download').removeAttribute('disabled');
        document.getElementById('download').style.display = 'block';

        // Update the JSON data in the hidden div and show the "Show Data" button
        jsonDataDiv.innerHTML = '<pre>' + JSON.stringify(formattedData, null, 4) + '</pre>';
        document.getElementById('showDataBtn').style.display = 'block';
        document.getElementById('hideDataBtn').style.display = 'none';

        // Store the formatted data in window.formattedData
        window.formattedData = formattedData;
    })
    .catch(function (error) {
        console.error('Error fetching data:', error);
        document.getElementById('result').innerHTML =
            'Error fetching data. Please try again later.';
    });

    // Disable the "Download CSV" button while submitting
    document.getElementById('download').setAttribute('disabled', 'true');
});

document.getElementById('download').addEventListener('click', function () {
    if (!window.formattedData || window.formattedData.length === 0) {
        console.error('Data not available. Please submit the form first.');
        return;
    }

    var csv =
        'Created by Libre validator Quantum - please vote for us on Libre.\n' + // Custom text at the top
        'Date,Sender,Recipient,Quantity,Memo,Transaction ID\n' +
        window.formattedData.map(function (row) {
            return Object.values(row).join(',');
        }).join('\n');
    var blob = new Blob([csv], { type: 'text/csv' });

    // Create a download link and trigger the download
    var a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = 'transactions.csv';
    a.style.display = 'none';
    document.body.appendChild(a);
    a.click();
    URL.revokeObjectURL(a.href); // Release the object URL to free resources
    document.body.removeChild(a); // Remove the download link
});

// Additional event listener to trigger the download
document.getElementById('download').addEventListener('touchstart', function () {
    document.getElementById('download').click();
});

// Show Data Button
document.getElementById('showDataBtn').addEventListener('click', function () {
    document.getElementById('jsonData').style.display = 'block';
    document.getElementById('showDataBtn').style.display = 'none';
    document.getElementById('hideDataBtn').style.display = 'block';
});

// Hide Data Button
document.getElementById('hideDataBtn').addEventListener('click', function () {
    document.getElementById('jsonData').style.display = 'none';
    document.getElementById('showDataBtn').style.display = 'block';
    document.getElementById('hideDataBtn').style.display = 'none';
});

document.getElementById('network').addEventListener('change', function() {
    const customEndpoint = document.getElementById('customEndpoint');
    if (this.value === 'custom') {
        customEndpoint.style.display = 'block';
    } else {
        customEndpoint.style.display = 'none';
    }
});
