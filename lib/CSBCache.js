 function CSBCache(maxSize) {

     let cache = {};
    let size = 0;
    const clearingRatio = 0.5;


    this.load = function (uid) {
        if (cache[uid]) {
            cache[uid].count += 1;
            return cache[uid].instance;
        }

        return undefined;
    };

    this.put = function (uid, obj) {
        if (size > maxSize) {
            clear();
        } else {
            size++;
            cache[uid] = {
                instance: obj,
                count: 0
            };
        }

    };

    //-------------------------internal methods---------------------------------------

    function clear() {
        size = maxSize - Math.round(clearingRatio * maxSize);

        const entries = Object.entries(cache);
        cache = entries
            .sort((arr1, arr2) => {
                return arr2[1].count - arr1[1].count;
            })
            .slice(0, size)
            .reduce((obj, [k, v]) => {
                obj[k] = v;
                return obj;
            }, {});
    }
}

module.exports = CSBCache;
