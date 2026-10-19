const DAILY_BACKUP_MARKER = 'surti-bite-managed-daily-backup-v1';

function sourceFingerprint_(spreadsheet) {
  const names=['Orders','Expenses','RequestLog','StoreSessions','Settlements','Items','Settings'];
  const values=names.map(name=>{
    const sheet=spreadsheet.getSheetByName(name);
    if(!sheet)throw new Error('Missing source tab: '+name);
    return [name,sheet.getDataRange().getValues()];
  });
  return Utilities.base64EncodeWebSafe(Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256,JSON.stringify(values)));
}

function runDailyBackup() {
  const lock=LockService.getScriptLock();
  lock.waitLock(30000);
  const properties=PropertiesService.getScriptProperties();
  try {
    SpreadsheetApp.flush();
    const source=ss_();
    const fingerprint=sourceFingerprint_(source);
    const now=new Date();
    const folder=getManagedFolder_(APP.BACKUP_FOLDER);
    const name=getFileNamePrefix_()+' Daily Backup '+Utilities.formatDate(now,APP.TZ,'yyyyMMdd-HHmmss');
    const copy=DriveApp.getFileById(APP.SPREADSHEET_ID).makeCopy(name,folder);
    if(sourceFingerprint_(SpreadsheetApp.openById(copy.getId()))!==fingerprint)throw new Error('Backup verification failed; copy retained for inspection.');
    copy.setDescription(DAILY_BACKUP_MARKER);
    properties.setProperty('daily-backup-at',now.toISOString());
    properties.setProperty('daily-backup-url',copy.getUrl());
    properties.deleteProperty('daily-backup-error');
    // Keep 30 days. Only our verified daily backups qualify; manual/monthly/recovery copies do not.
    const cutoff=now.getTime()-30*86400000;
    const files=folder.getFiles();
    while(files.hasNext()){
      const file=files.next();
      if(file.getId()!==copy.getId() && file.getDescription()===DAILY_BACKUP_MARKER &&
         file.getName().indexOf(getFileNamePrefix_()+' Daily Backup ')===0 && file.getDateCreated().getTime()<cutoff)file.setTrashed(true);
    }
    return {verified:true,url:copy.getUrl(),fingerprint:fingerprint};
  }catch(error){
    properties.setProperty('daily-backup-error',String(error.message||error));
    throw error;
  }finally{lock.releaseLock();}
}

function testBackupRecovery() {
  const properties=PropertiesService.getScriptProperties();
  const url=properties.getProperty('daily-backup-url');
  if(!url)throw new Error('Run runDailyBackup first.');
  const match=url.match(/[-\w]{25,}/);
  if(!match)throw new Error('Invalid backup reference.');
  const backup=DriveApp.getFileById(match[0]);
  const expected=sourceFingerprint_(SpreadsheetApp.openById(backup.getId()));
  const restored=backup.makeCopy(getFileNamePrefix_()+' Recovery Test '+Utilities.formatDate(new Date(),APP.TZ,'yyyyMMdd-HHmmss'),getManagedFolder_(APP.BACKUP_FOLDER));
  if(sourceFingerprint_(SpreadsheetApp.openById(restored.getId()))!==expected)throw new Error('Recovery-copy verification failed. Production is unchanged.');
  properties.setProperty('recovery-test-at',new Date().toISOString());
  properties.setProperty('recovery-test-url',restored.getUrl());
  return {verified:true,url:restored.getUrl(),productionUnchanged:true};
}

function getOperationalStatus_() {
  const properties=PropertiesService.getScriptProperties().getProperties();
  return {
    refreshedAt:properties['read-model-updated-at']||'',
    refreshError:properties['read-model-error']||'',
    pendingDays:Object.keys(properties).filter(key=>key.indexOf('dirty-day-')===0).length,
    backupAt:properties['daily-backup-at']||'',backupUrl:properties['daily-backup-url']||'',
    backupError:properties['daily-backup-error']||'',recoveryTestAt:properties['recovery-test-at']||''
  };
}

function installReliabilityImprovements() {
  const backup=runDailyBackup();
  const recovery=testBackupRecovery();
  const handlers=ScriptApp.getProjectTriggers().map(trigger=>trigger.getHandlerFunction());
  if(handlers.indexOf('runDailyBackup')===-1)ScriptApp.newTrigger('runDailyBackup').timeBased().atHour(2).everyDays(1).inTimezone(APP.TZ).create();
  return {backup:backup,recovery:recovery,retentionDays:30};
}
