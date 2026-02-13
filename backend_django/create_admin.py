import os
import django

os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'config.settings')
django.setup()

from django.contrib.auth.models import User

def create_super_admin():
    email = "admin@teamsheets.com"
    password = "password123"
    
    # Check if exists
    if User.objects.filter(username=email).exists():
        print(f"User {email} already exists. Updating password.")
        u = User.objects.get(username=email)
        u.set_password(password)
        u.is_superuser = True
        u.is_staff = True
        u.email = email
        u.save()
    else:
        print(f"Creating new superuser: {email}")
        User.objects.create_superuser(username=email, email=email, password=password)
    
    print(f"Superuser created/updated.\nUsername: {email}\nPassword: {password}")

if __name__ == '__main__':
    create_super_admin()
