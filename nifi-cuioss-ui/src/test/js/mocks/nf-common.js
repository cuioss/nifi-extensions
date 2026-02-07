// Mock for nf.Common used in NiFi framework shim
module.exports = {
    formatValue: (v) => v,
    substringAfterLast: (str, sep) => {
        const idx = str.lastIndexOf(sep);
        return idx >= 0 ? str.substring(idx + sep.length) : str;
    }
};
