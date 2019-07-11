require("./flows/BricksManager");

function EDFSMiddleware(server) {
    server.post('/EDFS', (req, res) => {
        //preventing illegal characters passing as fileId
        res.statusCode = 400;
        res.end();
    });

    server.post('/:fileId', (req, res) => {
        $$.flow.start("BricksManager").write(req.params.fileId, req, function (err, result) {
            res.statusCode = 201;
            if (err) {
                res.statusCode = 500;

                if (err.code === 'EACCES') {
                    res.statusCode = 409;
                }
            }
            res.end();
        });

    });

    server.get('/:fileId', (req, res) => {
        res.setHeader("content-type", "application/octet-stream");
        $$.flow.start("BricksManager").read(req.params.fileId, res, function (err, result) {
            res.statusCode = 200;
            if (err) {
                console.log(err);
                res.statusCode = 404;
            }
            res.end();
        });
    });

}

module.exports = EDFSMiddleware;