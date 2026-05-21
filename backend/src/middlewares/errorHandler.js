'use strict';

function errorHandler(err, req, res, next) {
  const status = err.status || err.statusCode || 500;
  const isDev = process.env.NODE_ENV === 'development';

  if (status >= 500) {
    console.error('[ERROR]', err.message, isDev ? err.stack : '');
  }

  res.status(status).json({
    error: err.message || 'Erro interno do servidor.',
    ...(isDev && { stack: err.stack }),
  });
}

module.exports = errorHandler;
