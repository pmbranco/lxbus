'''
Created on Sep 20, 2010

@author: simao
'''

import lxbus
from google.appengine.ext import webapp

import logging
from google.appengine.ext.webapp.mail_handlers import InboundMailHandler 

try:
    from django.utils import simplejson
except (ImportError):
    import simplejson

LXBUS_REPLY_NOBUSES = -1
LXBUS_REPLY_UNKNOWN_RQ = -2
LXBUS_REPLY_NOT_RETURNED = -3

class LxbusRequestNewHandler(webapp.RequestHandler):
    '''
    Send an email
    '''
    def get(self):
        stopcode = self.request.get("stopcode")
        
        if stopcode == "":
            self.response.set_status(400)
            self.response.out.write("Bad request. Check specs.")
            return False
        
        success = lxbus.getNewBus(stopcode)
        
        if success != None:
            self.response.set_status(202)
            
            json = simplejson.dumps([{
            "statuscode" : 1,
            "requestid": success
            }], sort_keys=True, indent=4) # Pretty print

            self.response.set_status(202)
            self.response.headers['Content-Type'] = 'application/json; charset=utf-8'
            self.response.out.write(json)
            
        else:
            self.response.set_status(500)
            self.response.out.write("An error ocurred. Try later.")
            
        return True


class LxbusRequestUpdateHandler(webapp.RequestHandler):
    '''
    Check if there are updates to a bus stop
    '''
    def get(self):

        stopcode = self.request.get("stopcode")
        requestid = self.request.get("requestid")
        
        if (stopcode == "") or (requestid == ""):
            self.response.set_status(400)
            self.response.out.write("Bad request. Check specs.")
            return False
        
        request = lxbus.getRequest(requestid)
        
        errormsg = None
        errorcode = 0
        
        if(request == None):
            errormsg = "No such request."
            errorcode = LXBUS_REPLY_NOBUSES
        elif (request.isRequestReturned() == False):
            errormsg = "Reply to stopcode %s not yet returned" % request.stopcode
            errorcode = LXBUS_REPLY_NOT_RETURNED
        elif (request.isRequestWithResults() == False):
            errormsg = "No bus information for stop code %s" % request.stopcode
            errorcode = LXBUS_REPLY_NOBUSES
            
        if (errormsg != None):
            json = simplejson.dumps([{"statuscode" : errorcode, "message" : errormsg}])
        else:
            entries = lxbus.getUpdateBus(request)
            
            json = simplejson.dumps(
                [{ "statuscode" : 0, "message" : "", "payload" :   
                    [{
                    "busnr" : bus.busNumber,
                    "dest" : bus.dest,
                    "eta_minutes": bus.eta_minutes,
                    "pt_timestamp" : bus.pt_timestamp,
                    "last_modified": bus.last_modified.isoformat()
                } for bus in entries]  }], sort_keys=False, indent=4) # Pretty print

        if(errormsg != None):
            self.response.set_status(202)
        else:
            self.response.set_status(400)

        self.response.headers['Content-Type'] = 'application/json; charset=utf-8'
        self.response.out.write(json)



class LxbusMailHandler(InboundMailHandler):
    def receive(self, mail_message):
        logging.debug("Received a message from: " + mail_message.sender)
        
        stopcode = lxbus.CARRIS_SUBJECT_REGEX.search(mail_message.subject).group("stopcode")
        
        html_bodies = mail_message.bodies('text/html')

        for content_type, body in html_bodies:
            logging.debug("Parsing text: %s" % body.decode())
            lxbus.parseCarrisMail(stopcode, body.decode())


