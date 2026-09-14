import rateLimit from 'express-rate-limit';

export const apiLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 300,
  standardHeaders: true,
  legacyHeaders: false,
  message: { success: false, message: 'অনেক বেশি রিকোয়েস্ট, একটু পরে চেষ্টা করুন' },
});

export const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 30,
  standardHeaders: true,
  legacyHeaders: false,
  message: { success: false, message: 'অনেক বেশি লগইন চেষ্টা, ১৫ মিনিট পরে চেষ্টা করুন' },
});
