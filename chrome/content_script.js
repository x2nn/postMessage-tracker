(function() {
    var script = document.createElement('script');
    script.src = chrome.runtime.getURL('injected.js');
    (document.head || document.documentElement).appendChild(script);
    script.onload = function() {
        script.remove();
    };
})();

document.addEventListener('postMessageTracker', function(event) {
	if (typeof chrome !== 'undefined' && chrome.runtime && chrome.runtime.sendMessage) {
		try {
			chrome.runtime.sendMessage(event.detail);
		} catch (e) {
			// The context may have been invalidated just before this call.
			console.log("postMessage-tracker: Could not send message, context likely invalidated.");
		}
	}
});

//we use this to separate fragment changes with location changes
window.addEventListener('beforeunload', function(event) {
	var storeEvent = new CustomEvent('postMessageTracker', {'detail':{changePage:true}});
	document.dispatchEvent(storeEvent);
});
