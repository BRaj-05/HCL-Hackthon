/** A small Prisma persistence boundary for future services/controllers. */
class BaseRepository {
  constructor(delegate) {
    this.delegate = delegate;
  }

  create(data, options = {}) {
    return this.delegate.create({ data, ...options });
  }

  findById(id, options = {}) {
    return this.delegate.findUnique({ where: { id }, ...options });
  }

  findOne(where, options = {}) {
    return this.delegate.findFirst({ where, ...options });
  }

  find(where = {}, options = {}) {
    return this.delegate.findMany({ where, ...options });
  }

  update(id, data, options = {}) {
    return this.delegate.update({ where: { id }, data, ...options });
  }

  delete(id) {
    return this.delegate.delete({ where: { id } });
  }
}

module.exports = BaseRepository;
