function write(severity, message, fields = {}) {
  const record = JSON.stringify({ severity, message, ...fields });
  if (severity === 'ERROR') console.error(record);
  else console.log(record);
}

export const logger = {
  info(message, fields) { write('INFO', message, fields); },
  error(message, fields) { write('ERROR', message, fields); }
};
