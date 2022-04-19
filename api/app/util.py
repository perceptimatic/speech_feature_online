from passlib.context import CryptContext

pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")


def get_password_hash(password):
    """Hash a password according to specified context."""
    return pwd_context.hash(password)


async def create_user(db: Session, user: UserIn):
    """Create a new user."""
    new_user = User(
        email=user.email,
        password=get_password_hash(user.password),
        username=user.username,
        created=datetime.now(),
    )

    user_role = db.query(Role).filter(Role.role == "user").first()
    new_user.roles = [user_role]
    if user.is_admin:
        user_role = db.query(Role).filter(Role.role == "admin").first()
        new_user.roles.append(user_role)

    db.add(new_user)
    db.commit()

    return new_user

    # migration is here: recup_dir.314/f64977120.py
    # functional models: recup_dir.739/f163962112.java
    # probably better: recup_dir.749/f168132832.java
