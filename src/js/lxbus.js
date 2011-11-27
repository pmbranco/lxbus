/*
 This program is free software: you can redistribute it and/or modify
 it under the terms of the GNU General Public License as published by
 the Free Software Foundation, either version 3 of the License, or
 (at your option) any later version.

 This program is distributed in the hope that it will be useful,
 but WITHOUT ANY WARRANTY; without even the implied warranty of
 MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
 GNU General Public License for more details.

 You should have received a copy of the GNU General Public License
 along with this program.  If not, see <http://www.gnu.org/licenses/>.
 */

/**
 * General lxbus library.
 *
 * Holds code for the document.ready() event and for various tasks
 * executed by the application.
 *
 * @author Simão Mata <simao.m@gmail.com>
 */
var LXBUS_OK_CODE = 0;
var LXBUS_NO_BUSES = -1;
var LXBUS_NO_INFO_RETURNED = -2;
var LXBUS_NOT_YET_RETURNED = -3;
var LXBUS_REPLY_INVALID_CODE = -4;

/**
 * Number of seconds between polls to the server.
 *
 * Should be at least 5 seconds.
 */
var LXBUS_POLL_SECONDS = 5;

/**
 * Max number of poll tries before giving up. 
 */
var LXBUS_MAX_POLL_TRIES = 24; // Thats 24 * 5 = 120 seconds 

/**
 * Message to show if we couldn't receive a reply from carris
 */
var LXBUS_POLL_TIMEOUT_ERROR_MSG = "Could not get a response from Carris. Maybe you should try again?";

var lxbus = {};

// Holds all the functions for this module
lxbus.f = {};

// Number of tries already made
lxbus.nr_tries = 0;

/**
 * Changes the interface to Waiting Mode while
 * we poll the server.
 */
lxbus.f.showWaitUI = function () {
  
  $("#resultstable tbody").html("");
  
		$("#resultsdiv").hide();
    $("#helpdiv").hide();
		
		$("#inputdiv").hide();
		$("#waitdiv").show();
};

/**
 * Changes the interface to Show Results mode after
 * we receive information from the server.
 */
lxbus.f.showResultsUI = function () {
		if(lxbus.db.supports_storage)
			$("#previousCodes").html(lxbus.db.getAllCodesAsHTML());
	
	    $("#waitdiv").hide();
        $("#resultsdiv").show();
        $("#inputdiv").show();
};


/**
 * Polls the server to update the status of the request for information
 * about a stop.
 *
 * @param {Object} requestid
 */
lxbus.f.updateRequestResult = function(requestid){
  
    lxbus.nr_tries = lxbus.nr_tries + 1;
  
    $.ajax({
        url: '/api/updateBusRequest',
        async: true,
        ifModified: true,
        data: {
            requestid: requestid
        },
        success: function(data, status, xhr){
            if ((typeof data != 'undefined') && (data[0].statuscode != LXBUS_NOT_YET_RETURNED)) {
            
                lxbus.f.receiveUpdateReply(data);
                
            } else {
                if(lxbus.nr_tries < LXBUS_MAX_POLL_TRIES) {
                    // Try again in 5 seconds
                    setTimeout(lxbus.f.updateRequestResult, LXBUS_POLL_SECONDS * 1000, requestid);
                } else {
                  $("#resultsmainp").text(LXBUS_POLL_TIMEOUT_ERROR_MSG);
                  
                  lxbus.f.showResultsUI();
                }
            }
        }
    })
};

/**
 * Receives an update to an information request in the event the server
 * replies to our request.
 *
 * Note that this function treats all types of replies received from the server
 * except LXBUS_NOT_YET_RETURNED.
 *
 * @param {Object} data received by polling the server
 */
lxbus.f.receiveUpdateReply = function(data){

    var returncode = data[0].statuscode
    
    if (returncode < LXBUS_OK_CODE) {
        // If this was an invalid stop code, remove it
        if(returncode == LXBUS_REPLY_INVALID_CODE) {
          if(lxbus.db.supports_storage)
          {
            lxbus.db.delStop(data[0].stopcode);
          }
        }

        // Just show the error msg we received
        $("#resultsmainp").text(data[0].message);

    } else {
        // Prepare table header and
        // Fill table with information
        var newRows = "";
        
        $("#resultstable tbody").html(" <tr> " +
        "<th scope=\"col\">Bus</th><th scope=\"col\">Direction</th><th scope=\"col\">Wait (m)</th><th scope=\"col\">ETA</th>" +
        " </tr>");
        
        
        for (i = 0; i < data[0].payload.length; i++) {
            o = data[0].payload[i]
            newRows += "<tr>" +
            "<td>" +
            o.busnr +
            "</td>" +
            "<td>" +
            o.dest +
            "</td>" +
            "<td>" +
            o.eta_minutes +
            "</td>" +
            "<td>" +
            o.pt_timestamp +
            "</td>" +
            "</tr>";
        }
        
        $('#resultstable tr:last').after(newRows);
        
        $("#resultsmainp").text(data[0].message);
     }
	 
	 lxbus.f.showResultsUI();
};


/**
 * Sends a new request for a stop code.
 *
 * After sending the request, it calls {@link lxbus.f.updateRequestResult}
 * so it polls the server to check if there are updates to this request.
 *
 * @param {String} stopcode
 */
lxbus.f.putNewRequestFunc = function(stopcode){
    $.ajax({
        type: 'POST',
        url: '/api/newBusRequest',
        async: true,
        ifModified: true,
        data: {
            stopcode: stopcode
        },
        success: function(data, status, xhr){
            if (typeof data != 'undefined') {
                data = data[0];
                
                lxbus.f.receivePutReply(data);
            } else {
                alert("Could not send a new request for a stopcode")
            }
        }
    })
}

/**
 * Receives a reply to a put request.
 *
 * @param {Object} data
 */
lxbus.f.receivePutReply = function(data){
    if (data.status_code < LXBUS_OK_CODE) {
        alert("The server responded with an error. Please try again.");
    } else {
        // start polling the server in 5 seconds
        setTimeout(lxbus.f.updateRequestResult, LXBUS_POLL_SECONDS * 1000, data.requestid);
    }
};


/**
 * This function os meant to be called once, on a $(document).ready()
 */
lxbus.f.setUp = function () {
    if (lxbus.db.supports_storage) {
        lxbus.db.open();

        $("#previousCodes").show();
        $("#previousCodes").html(lxbus.db.getAllCodesAsHTML());

        $("#previousCodes a").live("click", function(event) {
            event.preventDefault();

            $("#stopcode").val($(this).text());
            $("#stopcode").submit();
        })
    }


    $('#goform').submit(function(event) {
        event.preventDefault()

        if ($("#stopcode").val() == "") {
            alert("Please input a stop code")
        } else {
            lxbus.f.showWaitUI();
            lxbus.f.putNewRequestFunc($("#stopcode").val());

            if (lxbus.db.supports_storage) {
                lxbus.db.addStopCode($("#stopcode").val());
            }
        }
    });
};


