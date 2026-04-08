from django.contrib import admin

from .models import Product, Sale, SaleItem, Section

admin.site.register(Section)
admin.site.register(Product)
admin.site.register(Sale)
admin.site.register(SaleItem)
