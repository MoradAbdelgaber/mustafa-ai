const express = require('express');
const sharp = require('sharp');

const app = express();
const port = process.env.PORT || 3610;

// للسماح بتحليل بيانات JSON (مع زيادة الحد في حالة الصور الكبيرة)
app.use(express.json({ limit: '50mb' }));

// دالة لترميز طول التشغيل (RLE) على بيانات البكسل
function runLengthEncode(pixelData) {
  let result = '';
  let count = 1;
  // نفترض أن بيانات البكسل عبارة عن مصفوفة من القيم الرقمية
  for (let i = 1; i <= pixelData.length; i++) {
    if (i < pixelData.length && pixelData[i] === pixelData[i - 1]) {
      count++;
    } else {
      result += `${pixelData[i - 1]}(${count})`;
      count = 1;
    }
  }
  return result;
}

// نقطة النهاية التي تستقبل صورة بصيغة Base64 وتعيد التمثيل المشفر
app.post('/encode', async (req, res) => {
  try {
    // نتوقع أن يحتوي جسم الطلب على خاصية "image" بصيغة Base64
    let { image } = req.body;
    if (!image) {
      return res.status(400).json({ error: 'لم يتم إرسال الصورة' });
    }
    
    // إزالة جزء رأس البيانات إذا كانت الصورة عبارة عن data URL
    const base64Data = image.replace(/^data:image\/\w+;base64,/, '');
    // تحويل النص إلى Buffer
    const imageBuffer = Buffer.from(base64Data, 'base64');

    // استخدام sharp لمعالجة الصورة، تحويلها إلى تدرج الرمادي واستخراج بيانات البكسل الخام
    const { data } = await sharp(imageBuffer)
      .greyscale()
      .raw()
      .toBuffer({ resolveWithObject: true });
    
    // تحويل Buffer إلى مصفوفة من القيم
    const pixelArray = Array.from(data);

    // تطبيق ترميز طول التشغيل على بيانات البكسل
    const encoded = runLengthEncode(pixelArray);

    return res.json({ encoded });
  } catch (error) {
    console.error('خطأ في معالجة الصورة:', error);
    return res.status(500).json({ error: 'حدث خطأ أثناء معالجة الصورة' });
  }
});

app.listen(port, () => {
  console.log(`الخادم يعمل على المنفذ ${port}`);
});
