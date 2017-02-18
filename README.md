<div dir=rtl>


# مرتب

نوشتن [markdown] برای زبان فارسی خیلی آسان نیست؛ مخصوصا برای متون دانشگاهی که پر از *پاورقی*، *فرمول*، *ارجاع*، *شکل* و *جدول* هستند. ویرایشگر **مرتب** قرار است این کار را آسان کند.

توسعه این ویرایشگر با ساده‌سازی پروژه [StackEdit] شروع شده و هدف از آغاز آن، تسهیل ویرایش متون در سایت [بوته] بوده است.

کد تبدیل نوشته `مرتب` به اچ‌تی‌ام‌ال هم جزء پروژه است. دو کتابخانه [marked] و [mistune] به عنوان کد پایه انتخاب شده‌اند که ویژگی شخصی‌سازی در آنها، اعمال تغییرات را آسان کرده است.


## نصب

بسته پایتون `moratab` آسان نصب می‌شود:

```
pip install moratab
```

و استفاده از آن هم پیچیده نیست:

```python
>>> from moratab import render
>>> render(text)
```


[بوته]: http://www.boute.ir
[markdown]: http://daringfireball.net/projects/markdown/
[marked]: https://github.com/chjj/marked 
[mistune]: https://github.com/lepture/mistune
[StackEdit]: https://github.com/benweet/stackedit
