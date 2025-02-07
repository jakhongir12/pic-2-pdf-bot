require('dotenv').config();
const { Telegraf, Markup } = require('telegraf');
const fs = require('fs-extra');
const axios = require('axios');
const { PDFDocument } = require('pdf-lib');

const bot = new Telegraf(process.env.BOT_TOKEN);
const users = {};

const languages = {
    en: 'English',
    ru: 'Русский',
    pl: 'Polski',
    ky: 'Кыргызча',
    uz: 'Oʻzbekcha',
};

const translations = {
    en: {
        start: 'Please choose your language:',
        askImages: 'Now, send the images you want to convert to PDF. When finished, type "Finish".',
        imageReceived: 'Image received. Send more or type "Finish" when done.',
        noImages: 'No images received. Please send images first.',
        converting: 'Converting images to PDF...',
        pdfReady: 'PDF is ready. Do you want to rename it?',
        askRename: 'Please send the new file name (without extension).',
        thankYou: 'Thank you for using the bot! Type /start to begin a new conversion.',
        invalidName: 'Invalid file name or file already exists. Please try again.',
    },
    ru: {
        start: 'Пожалуйста, выберите язык:',
        askImages: 'Теперь отправьте изображения, которые вы хотите конвертировать в PDF. Когда закончите, напишите "Finish".',
        imageReceived: 'Изображение получено. Отправьте еще или напишите "Finish", когда закончите.',
        noImages: 'Изображений не получено. Пожалуйста, отправьте изображения.',
        converting: 'Конвертируем изображения в PDF...',
        pdfReady: 'PDF готов. Хотите изменить имя файла?',
        askRename: 'Пожалуйста, отправьте новое имя файла (без расширения).',
        thankYou: 'Спасибо за использование бота! Напишите /start, чтобы начать новое преобразование.',
        invalidName: 'Недопустимое имя файла или файл с таким именем уже существует. Пожалуйста, попробуйте снова.',
    },
    pl: {
        start: 'Wybierz język:',
        askImages: 'Wyślij teraz obrazy, które chcesz przekonwertować na PDF. Po zakończeniu napisz "Finish".',
        imageReceived: 'Obrazek odebrany. Wyślij więcej lub napisz "Finish", gdy skończysz.',
        noImages: 'Nie otrzymano obrazów. Proszę wyślij obrazy.',
        converting: 'Konwertuję obrazy na PDF...',
        pdfReady: 'PDF jest gotowy. Chcesz zmienić nazwę pliku?',
        askRename: 'Proszę podać nową nazwę pliku (bez rozszerzenia).',
        thankYou: 'Dziękujemy za skorzystanie z bota! Napisz /start, aby rozpocząć nowe konwertowanie.',
        invalidName: 'Nieprawidłowa nazwa pliku lub plik o tej nazwie już istnieje. Spróbuj ponownie.',
    },
    ky: {
        start: 'Тилди тандаңыз:',
        askImages: 'Эми PDFке айландырууну каалаган сүрөттөрдү жибериңиз. Аяктаган соң "Finish" деп жазыңыз.',
        imageReceived: 'Сүрөт алынган. Көбүрөөк жиберүү же "Finish" деп жазып бүткөнүңүздү билдирүү.',
        noImages: 'Сүрөттөр алынган жок. Сураныч, сүрөттөрдү жибериңиз.',
        converting: 'Сүрөттөрдү PDFке айландыруу...',
        pdfReady: 'PDF даяр. Файлдын атын өзгөртүшүңүз керекпи?',
        askRename: 'Жаңы файл атын жибериңиз (кошумча жок).',
        thankYou: 'Ботту колдонгонуңуз үчүн рахмат! /start деп жазып, жаңы конвертация баштаңыз.',
        invalidName: 'Жаңы файл аты туура эмес же ушундай аттагы файл бар. Сураныч, кайрадан аракет кылып көрүңүз.',
    },
    uz: {
        start: 'Iltimos, tilni tanlang:',
        askImages: 'Endi PDFga aylantirmoqchi bo\'lgan rasmlaringizni yuboring. Tugatganingizda "Finish" deb yozing.',
        imageReceived: 'Rasm olindi. Ko\'proq yuboring yoki tugatganingizni "Finish" deb yozing.',
        noImages: 'Rasmlar olinmadi. Iltimos, rasmlarni yuboring.',
        converting: 'Rasmlarni PDFga aylantirmoqda...',
        pdfReady: 'PDF tayyor. Fayl nomini o\'zgartirmoqchimisiz?',
        askRename: 'Yangi fayl nomini yuboring (kengaytmasiz).',
        thankYou: 'Botdan foydalanishingiz uchun rahmat! Yangi konvertatsiya boshlash uchun /start deb yozing.',
        invalidName: 'Noto\'g\'ri fayl nomi yoki bunday nomdagi fayl allaqachon mavjud. Iltimos, yana urinib ko\'ring.',
    },
};

bot.start((ctx) => {
    const userId = ctx.from.id;
    const language = users[userId]?.language || 'en';  // Use the selected language or default to English
    ctx.reply(translations[language].start,
        Markup.keyboard(Object.values(languages)).oneTime().resize());
});

bot.hears(Object.values(languages), (ctx) => {
    const userId = ctx.from.id;
    users[userId] = { language: Object.keys(languages).find(key => languages[key] === ctx.message.text), images: [] };
    const language = users[userId].language;
    ctx.reply(translations[language].askImages);
});

bot.on('photo', async (ctx) => {
    const userId = ctx.from.id;
    if (!users[userId]) return ctx.reply('Please select a language first.');

    const language = users[userId].language;
    const fileId = ctx.message.photo[ctx.message.photo.length - 1].file_id;
    const fileUrl = await ctx.telegram.getFileLink(fileId);
    users[userId].images.push(fileUrl);
    ctx.reply(translations[language].imageReceived);
});

bot.hears(/finish/i, async (ctx) => {
    const userId = ctx.from.id;
    if (!users[userId] || users[userId].images.length === 0) {
        const language = users[userId]?.language || 'en';
        return ctx.reply(translations[language].noImages);
    }

    const language = users[userId].language;
    ctx.reply(translations[language].converting);
    const pdfDoc = await PDFDocument.create();
    for (const imgUrl of users[userId].images) {
        const response = await axios.get(imgUrl, { responseType: 'arraybuffer' });
        const imageBytes = response.data;
        const image = await pdfDoc.embedJpg(imageBytes).catch(() => pdfDoc.embedPng(imageBytes));
        const page = pdfDoc.addPage([image.width, image.height]);
        page.drawImage(image, { x: 0, y: 0, width: image.width, height: image.height });
    }

    const pdfBytes = await pdfDoc.save();
    const filePath = `./output_${userId}.pdf`;
    fs.writeFileSync(filePath, pdfBytes);

    ctx.reply(translations[language].pdfReady, Markup.keyboard(['Yes', 'No']).oneTime().resize());
});

bot.hears('Yes', (ctx) => {
    const userId = ctx.from.id;
    const language = users[userId].language;
    ctx.reply(translations[language].askRename);
});

bot.on('text', async (ctx) => {
    const userId = ctx.from.id;
    const language = users[userId]?.language || 'en';

    if (users[userId] && fs.existsSync(`./output_${userId}.pdf`)) {
        const newFileName = ctx.message.text.trim();

        if (newFileName && !fs.existsSync(`./${newFileName}.pdf`)) {
            const oldFilePath = `./output_${userId}.pdf`;
            const newFilePath = `./${newFileName}.pdf`;
            fs.renameSync(oldFilePath, newFilePath);
            await ctx.replyWithDocument({ source: newFilePath });
            fs.unlinkSync(newFilePath); // Safely delete after sending
        } else {
            ctx.reply(translations[language].invalidName);
        }
    }

    ctx.reply(translations[language].thankYou);
    delete users[userId]; // Clear session after the process is finished
});

bot.hears('No', async (ctx) => {
    const userId = ctx.from.id;
    const language = users[userId]?.language || 'en';
    if (fs.existsSync(`./output_${userId}.pdf`)) {
        await ctx.replyWithDocument({ source: `./output_${userId}.pdf` });
        fs.unlinkSync(`./output_${userId}.pdf`);
    }

    ctx.reply(translations[language].thankYou);
    delete users[userId]; // Clear session after the process is finished
});

bot.launch();
console.log('Bot is running...');
