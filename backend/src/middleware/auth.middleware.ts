import { NextFunction, Request, Response } from 'express';
import { EntityManager, RequestContext, UniqueConstraintViolationException } from '@mikro-orm/core';
import { getFirebaseAuth, isDevAuth } from '../config/firebase';
import { User } from '../entities/User';

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Express {
    interface Request {
      user?: User;
    }
  }
}

/**
 * Erster Login: Beim ersten Laden schickt das Dashboard mehrere Anfragen gleichzeitig,
 * die alle den Benutzer anlegen wollen. Gewinnt eine andere Anfrage, den vorhandenen laden.
 */
async function createUserOnce(em: EntityManager, firebaseUid: string, email: string): Promise<User> {
  try {
    const created = em.create(User, { firebaseUid, email, currency: 'EUR', language: 'de', remindersEnabled: false, reminderDaysBefore: 7, reminderOverdue: false, createdAt: new Date() });
    await em.flush();
    return created;
  } catch (err) {
    if (err instanceof UniqueConstraintViolationException) {
      em.clear();
      return em.findOneOrFail(User, { firebaseUid });
    }
    throw err;
  }
}

export async function requireAuth(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    let firebaseUid: string;
    let email: string;

    if (isDevAuth()) {
      firebaseUid = req.header('x-dev-user') ?? 'dev-user';
      email = `${firebaseUid}@localhost`;
    } else {
      const header = req.header('authorization') ?? '';
      if (!header.startsWith('Bearer ')) {
        res.status(401).json({ error: 'Kein Token' });
        return;
      }
      const decoded = await getFirebaseAuth().verifyIdToken(header.substring(7));
      firebaseUid = decoded.uid;
      email = decoded.email ?? '';
    }

    const em = RequestContext.getEntityManager();
    if (!em) {
      throw new Error('Kein EntityManager im RequestContext');
    }

    let user = await em.findOne(User, { firebaseUid });
    if (!user) {
      user = await createUserOnce(em, firebaseUid, email);
    }
    req.user = user;
    next();
  } catch (err) {
    // Grund ins Log (z. B. abgelaufenes Token oder falsche Firebase-Konfiguration), nicht an den Client
    console.warn('Auth fehlgeschlagen:', (err as Error).message);
    res.status(401).json({ error: 'Ungültiges Token' });
  }
}
