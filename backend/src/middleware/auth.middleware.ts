import { NextFunction, Request, Response } from 'express';
import { RequestContext } from '@mikro-orm/core';
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
      user = em.create(User, { firebaseUid, email, currency: 'EUR', createdAt: new Date() });
      await em.flush();
    }
    req.user = user;
    next();
  } catch (err) {
    res.status(401).json({ error: 'Ungültiges Token' });
  }
}
