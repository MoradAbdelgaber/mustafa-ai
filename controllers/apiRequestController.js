// controllers/apiRequestController.js
const ApiRequest = require('../models/ApiRequest');
exports.createRequest = async (req, res) => {
  try {
    const data = {
      ...req.body,
      owner: req.userId  // تأكد من وجود ميدل وير يضع userId
    };
  
    
    const request = await ApiRequest.create(data);
    res.status(201).json(request);
  } catch (error) {
    console.error(error);
    res.status(400).json({ error: 'Error creating api request' });
  }
};


exports.getAllRequests = async (req, res) => {
  try {
    const { status } = req.query;

    // اجعل filter يراعي المالك
    const filter = { owner: req.userId };

    // أضف فلترة الحالة إذا أرسلت
    if (status) {
      filter.status = status;
    }

    // جلب النتائج
    const data = await ApiRequest.find(filter);
    res.json(data);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Error fetching requests' });
  }
};


exports.getRequestById = async (req, res) => {
  try {
    const { id } = req.params;

    // ابحث عن الطلب بهذا id والذي يملكه المستخدم
    const request = await ApiRequest.findOne({ _id: id, owner: req.userId });
    if (!request) {
      return res.status(404).json({ message: 'Api request not found or not owned by you' });
    }
    res.json(request);
  } catch (error) {
    console.error(error);
    res.status(400).json({ error: 'Error fetching request' });
  }
};

//تعديل مجموعة طلبات 
exports.bulkUpdateRequests = async (req, res) => {
  try {
    // نتوقع استلام مصفوفة من الآي ديز في req.body.ids
    const { ids } = req.body;

    if (!Array.isArray(ids) || ids.length === 0) {
      return res.status(400).json({ message: 'يرجى إرسال مصفوفة تحتوي على آي ديز صحيحة' });
    }

    // تحديث جميع الطلبات التي يملكها المستخدم الحالي والتي تتطابق مع الآي ديز المرسلة
    const result = await ApiRequest.updateMany(
      { _id: { $in: ids }, owner: req.userId },
      { running_times: 0, status: 'pending' }
    );

    // التأكد مما إذا كانت العملية نجحت بتحديث بعض السجلات
    if (result.nModified === 0) {
      return res.status(404).json({ message: 'لم يتم العثور على طلبات مطابقة أو أنها غير مملوكة لك' });
    }

    res.json({ message: 'تم تحديث الطلبات بنجاح', result });
  } catch (error) {
    console.error(error);
    res.status(400).json({ error: 'حدث خطأ أثناء تحديث الطلبات' });
  }
};


exports.updateRequest = async (req, res) => {
  try {
    const { id } = req.params;

    // ابحث وحدث بما يخص نفس المالك
    const updatedReq = await ApiRequest.findOneAndUpdate(
      { _id: id, owner: req.userId },
      req.body,
      { new: true }
    );

    if (!updatedReq) {
      return res.status(404).json({ message: 'Api request not found or not owned by you' });
    }
    res.json(updatedReq);
  } catch (error) {
    console.error(error);
    res.status(400).json({ error: 'Error updating request' });
  }
};


exports.deleteRequest = async (req, res) => {
  try {
    const { id } = req.params;

    // ابحث واحذف بما يخص نفس المالك
    const deleted = await ApiRequest.findOneAndDelete({ _id: id, owner: req.userId });
    if (!deleted) {
      return res.status(404).json({ message: 'Api request not found or not owned by you' });
    }
    res.json({ message: 'Api request deleted successfully' });
  } catch (error) {
    console.error(error);
    res.status(400).json({ error: 'Error deleting request' });
  }
};

