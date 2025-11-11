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
			if (event.detail) { 
				chrome.runtime.sendMessage(event.detail);
			}
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

// Debounce utility
const debounce = function(func, delay) {
    let timeout;
    return function(...args) {
        const context = this;
        clearTimeout(timeout);
        timeout = setTimeout(() => func.apply(context, args), delay);
    };
};

// Initialize jQuery tracking
const initJQueryTracking = function() {
    try {
        const all = Object.getOwnPropertyNames(window);
        for (const key of all) {
            if (key.indexOf('jQuery') !== -1) {
                jqc(key);
            }
        }
    } catch (e) {
        console.error('Error initializing jQuery tracking:', e);
    }
};

const debouncedInitJQueryTracking = debounce(initJQueryTracking, 300);

// Set up MutationObserver to detect dynamically added scripts
const observer = new MutationObserver((mutations) => {
    debouncedInitJQueryTracking();
});
observer.observe(document.documentElement, {
    childList: true,
});
