from django.contrib import admin

from .models import PendingOrder, PendingOrderItem, Product, Sale, SaleItem, Section, UserProfile

admin.site.register(Section)
admin.site.register(Product)
admin.site.register(Sale)
admin.site.register(SaleItem)
admin.site.register(UserProfile)
admin.site.register(PendingOrder)
admin.site.register(PendingOrderItem)
