// =========================
// 共通定義
// =========================

const COURSE_SHEET_NAME = '授業設定';
const EVAL_SHEET_NAME = '相互評価';
const PRESENTER_SHEET_NAME = '発表者';

// 「相互評価」シートの列番号（1始まり）
const COL = {
  COURSE: 1,           // A: 授業ID
  PRESENTER: 2,        // B: 発表者
  EVALUATOR: 3,        // C: 評価者メール
  SCORE_START: 4,      // D: スコア開始
  SCORE_END: 13,       // M: スコア終了（10項目）
  POSITIVE: 14,        // N: 今後も続けてほしい点
  IMPROVEMENT: 15,     // O: 改善点
  INSUFFICIENT: 16,    // P: 準備不足
  TIMESTAMP: 17        // Q: タイムスタンプ
};

function getEvalSpreadsheet() {
  const id = getSpreadsheetId();
  return id
    ? SpreadsheetApp.openById(id)
    : SpreadsheetApp.getActiveSpreadsheet();
}

function getSpreadsheetId() {
  return PropertiesService
    .getScriptProperties()
    .getProperty('SPREADSHEET_ID');
}

function normalizeText_(value) {
  if (value === null || value === undefined) return '';
  return String(value).trim();
}

function isTrue_(value) {
  if (value === true) return true;
  const str = normalizeText_(value).toUpperCase();
  return str === 'TRUE' || str === '1' || str === 'YES' || str === 'ON';
}

function getCurrentUserEmail_() {
  const email = normalizeText_(Session.getActiveUser().getEmail());
  if (!email) {
    throw new Error(
      'Googleアカウントのメールアドレスを取得できませんでした。学校・大学等のGoogle Workspaceアカウントでログインしているか、Webアプリの公開設定をご確認ください。'
    );
  }
  return email;
}

// =========================
// Webアプリ
// =========================

function doGet() {
  try {
    return HtmlService
      .createHtmlOutputFromFile('index')
      .setTitle('模擬授業相互評価');
  } catch (e) {
    return HtmlService.createHtmlOutput('エラーが発生しました: ' + e.message);
  }
}

// =========================
// 授業設定
// =========================

function getCourseRecords_() {
  const ss = getEvalSpreadsheet();
  const sheet = ss.getSheetByName(COURSE_SHEET_NAME);

  if (!sheet) {
    throw new Error(`「${COURSE_SHEET_NAME}」シートが見つかりません。`);
  }

  const values = sheet.getDataRange().getDisplayValues();
  if (values.length < 2) return [];

  return values
    .slice(1)
    .map(row => ({
      id: normalizeText_(row[0]),
      name: normalizeText_(row[1]),
      code: normalizeText_(row[2]),
      active: isTrue_(row[3])
    }))
    .filter(course => course.id && course.name);
}

function findCourse_(courseId) {
  const targetId = normalizeText_(courseId);
  return getCourseRecords_().find(course => course.id === targetId) || null;
}

function getActiveCourses() {
  return getCourseRecords_()
    .filter(course => course.active)
    .map(course => ({ id: course.id, name: course.name }));
}

function getCoursesForAdmin() {
  return getCourseRecords_().map(course => ({
    id: course.id,
    name: course.name,
    active: course.active
  }));
}

function assertCourseAccess_(courseId, courseCode) {
  const course = findCourse_(courseId);

  if (!course) {
    throw new Error('指定された授業が見つかりません。');
  }

  if (!course.active) {
    throw new Error('この授業は現在、相互評価を受け付けていません。');
  }

  const enteredCode = normalizeText_(courseCode);
  if (!enteredCode || enteredCode !== course.code) {
    throw new Error('授業コードが正しくありません。');
  }

  return course;
}

function verifyCourseAccess(courseId, courseCode) {
  const course = assertCourseAccess_(courseId, courseCode);
  return {
    success: true,
    courseId: course.id,
    courseName: course.name
  };
}

// =========================
// 発表者
// =========================

function getPresenterRows_() {
  const ss = getEvalSpreadsheet();
  const sheet = ss.getSheetByName(PRESENTER_SHEET_NAME);

  if (!sheet) {
    throw new Error(`「${PRESENTER_SHEET_NAME}」シートが見つかりません。`);
  }

  const values = sheet.getDataRange().getDisplayValues();
  if (values.length < 2) return [];

  return values
    .slice(1)
    .map(row => ({
      courseId: normalizeText_(row[0]),
      presenter: normalizeText_(row[1]),
      email: normalizeText_(row[2])
    }))
    .filter(row => row.courseId && row.presenter);
}

function getPresenterNamesForCourse_(courseId) {
  const targetCourseId = normalizeText_(courseId);
  const names = getPresenterRows_()
    .filter(row => row.courseId === targetCourseId)
    .map(row => row.presenter);

  return [...new Set(names)];
}

function getPresenterEmails_(courseId, presenterName) {
  const targetCourseId = normalizeText_(courseId);
  const targetPresenter = normalizeText_(presenterName);

  const emails = getPresenterRows_()
    .filter(row =>
      row.courseId === targetCourseId &&
      row.presenter === targetPresenter &&
      row.email !== ''
    )
    .map(row => row.email);

  return [...new Set(emails)];
}

function getStudentIds(courseId, courseCode) {
  assertCourseAccess_(courseId, courseCode);
  return getPresenterNamesForCourse_(courseId);
}

function getPresenters(courseId) {
  const course = findCourse_(courseId);
  if (!course) {
    throw new Error('指定された授業が見つかりません。');
  }
  return getPresenterNamesForCourse_(courseId);
}

// =========================
// 二重評価チェック
// =========================

function checkEvaluationStatus(courseId, studentId, courseCode) {
  assertCourseAccess_(courseId, courseCode);

  const presenters = getPresenterNamesForCourse_(courseId);
  if (!presenters.includes(studentId)) {
    return { error: 'この授業には指定された発表者が登録されていません。' };
  }

  const ss = getEvalSpreadsheet();
  const sheet = ss.getSheetByName(EVAL_SHEET_NAME);

  if (!sheet) {
    throw new Error(`「${EVAL_SHEET_NAME}」シートが見つかりません。`);
  }

  const data = sheet.getDataRange().getValues();
  const userEmail = getCurrentUserEmail_();

  for (let i = 1; i < data.length; i++) {
    const rowCourse = normalizeText_(data[i][COL.COURSE - 1]);
    const rowPresenter = normalizeText_(data[i][COL.PRESENTER - 1]);
    const rowEvaluator = normalizeText_(data[i][COL.EVALUATOR - 1]);

    if (
      rowCourse === normalizeText_(courseId) &&
      rowPresenter === normalizeText_(studentId) &&
      rowEvaluator === userEmail
    ) {
      return { error: 'この評価者は、この発表者を既に評価しています。' };
    }
  }

  return { success: true };
}

// =========================
// 評価フォーム送信
// =========================

function processForm(formData) {
  if (!formData) {
    throw new Error('送信データがありません。');
  }

  const courseId = normalizeText_(formData.courseId);
  const studentId = normalizeText_(formData.studentId);
  const courseCode = normalizeText_(formData.courseCode);
  const course = assertCourseAccess_(courseId, courseCode);

  const presenters = getPresenterNamesForCourse_(courseId);
  if (!presenters.includes(studentId)) {
    throw new Error('指定された発表者は、この授業に登録されていません。');
  }

  if (!Array.isArray(formData.criteria) || formData.criteria.length !== 10) {
    throw new Error('評価項目のデータが正しくありません。');
  }

  const ss = getEvalSpreadsheet();
  const sheet = ss.getSheetByName(EVAL_SHEET_NAME);

  if (!sheet) {
    throw new Error(`「${EVAL_SHEET_NAME}」シートが見つかりません。`);
  }

  const userEmail = getCurrentUserEmail_();
  const tz = Session.getScriptTimeZone() || 'Asia/Tokyo';
  const ts = new Date();

  const lock = LockService.getScriptLock();
  lock.waitLock(10000);

  try {
    const existingData = sheet.getDataRange().getValues();

    for (let i = 1; i < existingData.length; i++) {
      const rowCourse = normalizeText_(existingData[i][COL.COURSE - 1]);
      const rowPresenter = normalizeText_(existingData[i][COL.PRESENTER - 1]);
      const rowEvaluator = normalizeText_(existingData[i][COL.EVALUATOR - 1]);

      if (
        rowCourse === courseId &&
        rowPresenter === studentId &&
        rowEvaluator === userEmail
      ) {
        throw new Error('この評価者は、この発表者を既に評価しています。');
      }
    }

    sheet.appendRow([
      courseId,
      studentId,
      userEmail,
      ...formData.criteria,
      formData.positiveFeedback || '',
      formData.improvementFeedback || '',
      formData.insufficientPreparation || '',
      ts
    ]);
  } finally {
    lock.releaseLock();
  }

  const scoreHeaderCount = COL.SCORE_END - COL.SCORE_START + 1;
  const scoreHeaders = sheet
    .getRange(1, COL.SCORE_START, 1, scoreHeaderCount)
    .getValues()[0];

  let body = '';
  body += '【相互評価 送信控え】\n';
  body += `授業: ${course.name}\n`;
  body += `評価日時: ${Utilities.formatDate(ts, tz, 'yyyy/MM/dd HH:mm')}\n`;
  body += `評価者: ${userEmail}\n`;
  body += `発表者: ${studentId}\n\n`;

  body += '［評価スコア］\n';
  for (let i = 0; i < scoreHeaders.length; i++) {
    body += `${scoreHeaders[i]}: ${formData.criteria[i]}\n`;
  }

  body += '\n［自由記述］\n';
  body += `今後も続けてほしい点: ${formData.positiveFeedback || '（未入力）'}\n`;
  body += `改善点: ${formData.improvementFeedback || '（未入力）'}\n`;
  body += `準備不足と感じた点: ${formData.insufficientPreparation || '（未入力）'}\n`;

  const subject = `【控え】${course.name} 相互評価の送信内容（発表者: ${studentId}）`;
  GmailApp.sendEmail(userEmail, subject, body);

  return { success: true };
}

// =========================
// スプレッドシートメニュー
// =========================

function onOpen() {
  SpreadsheetApp
    .getUi()
    .createMenu('相互評価ツール')
    .addItem('評価結果を送信', 'showPresenterSelector')
    .addToUi();
}

function showPresenterSelector() {
  const htmlOutput = HtmlService
    .createHtmlOutputFromFile('PresenterSelector')
    .setWidth(460)
    .setHeight(400);

  SpreadsheetApp
    .getUi()
    .showModalDialog(htmlOutput, '評価結果を送信');
}

// =========================
// 評価結果送信
// =========================

function sendEvaluationResultForPresenter(courseId, presenterName) {
  courseId = normalizeText_(courseId);
  presenterName = normalizeText_(presenterName);

  // 受付終了後でも結果送信できるよう、activeは確認しない
  const course = findCourse_(courseId);
  if (!course) {
    throw new Error(`授業「${courseId}」が見つかりません。`);
  }

  const ss = getEvalSpreadsheet();
  const evaluationSheet = ss.getSheetByName(EVAL_SHEET_NAME);

  if (!evaluationSheet) {
    throw new Error(`「${EVAL_SHEET_NAME}」シートが見つかりません。`);
  }

  const emails = getPresenterEmails_(courseId, presenterName);
  if (emails.length === 0) {
    throw new Error(
      `「${course.name}」の発表者「${presenterName}」のメールアドレスが見つかりませんでした。`
    );
  }

  if (evaluationSheet.getLastRow() < 2) {
    throw new Error(
      `「${course.name}」の発表者「${presenterName}」に対する評価が見つかりませんでした。`
    );
  }

  const evaluationData = evaluationSheet.getDataRange().getValues();
  const data = evaluationData.slice(1);

  const scoreHeaderCount = COL.SCORE_END - COL.SCORE_START + 1;
  const scoreHeaders = evaluationSheet
    .getRange(1, COL.SCORE_START, 1, scoreHeaderCount)
    .getValues()[0];

  const results = {
    scores: [],
    feedback: []
  };

  data.forEach(row => {
    const rowCourse = normalizeText_(row[COL.COURSE - 1]);
    const rowPresenter = normalizeText_(row[COL.PRESENTER - 1]);

    if (rowCourse === courseId && rowPresenter === presenterName) {
      const rowScores = row.slice(COL.SCORE_START - 1, COL.SCORE_END);
      const freeText = [
        row[COL.POSITIVE - 1] || '',
        row[COL.IMPROVEMENT - 1] || '',
        row[COL.INSUFFICIENT - 1] || ''
      ];

      results.scores.push(rowScores.map(Number));
      results.feedback.push(freeText);
    }
  });

  if (results.scores.length === 0) {
    throw new Error(
      `「${course.name}」の発表者「${presenterName}」に対する評価が見つかりませんでした。`
    );
  }

  const averageScores = Array.from({ length: scoreHeaderCount }, (_, i) => {
    const sum = results.scores.reduce(
      (acc, scores) => acc + (Number(scores[i]) || 0),
      0
    );
    return (sum / results.scores.length).toFixed(2);
  });

  let message = `こんにちは、${presenterName}の皆さん。\n\n`;
  message += `${course.name}の相互評価結果をお送りします。\n\n`;

  message += '【評価スコア平均】\n';
  scoreHeaders.forEach((header, i) => {
    message += `${header}: ${averageScores[i]}\n`;
  });

  message += '\n【フィードバック】\n';
  results.feedback.forEach((feedback, index) => {
    const [positive, improvement, insufficient] = feedback;

    message += `評価者 ${index + 1}:\n`;
    message += `  - 今後も続けてほしい点: ${positive || '（未入力）'}\n`;
    message += `  - 改善点: ${improvement || '（未入力）'}\n`;
    message += `  - 準備不足と感じた点: ${insufficient || '（未入力）'}\n\n`;
  });

  GmailApp.sendEmail(
    emails.join(','),
    `${course.name} 模擬授業 相互評価の結果`,
    message
  );

  return `「${course.name}」の発表者「${presenterName}」のメンバー${emails.length}名に評価結果を送信しました。`;
}
