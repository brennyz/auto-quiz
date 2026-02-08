-- Voorbeeldvragen middelbare school klas 1 (dieren, wiskunde, biologie, etc.)
-- Vul later aan tot ~500; of import via WhatsApp-bot.

insert into public.questions (category, question_nl, answer_nl, difficulty, source_url) values
-- Dieren
('dieren', 'Hoeveel poten heeft een spin?', 'acht', 1, null),
('dieren', 'Welk zoogdier vliegt?', 'vleermuis', 1, null),
('dieren', 'Wat is het grootste landzoogdier?', 'olifant', 1, null),
('dieren', 'Welk dier heeft de langste nek?', 'giraffe', 1, null),
('dieren', 'In welke richting draait het bloed bij een kikker?', 'rond', 1, null),
-- Wiskunde
('wiskunde', 'Wat is 7 maal 8?', '56', 1, null),
('wiskunde', 'Hoeveel is 144 gedeeld door 12?', '12', 1, null),
('wiskunde', 'Wat is de wortel van 81?', '9', 1, null),
('wiskunde', 'Hoeveel graden heeft een rechte hoek?', '90', 1, null),
('wiskunde', 'Wat is 15 procent van 200?', '30', 1, null),
-- Biologie
('biologie', 'Welk orgaan pompt het bloed rond?', 'hart', 1, null),
('biologie', 'Door welke delen van de plant gaat het water omhoog?', 'stengel', 1, null),
('biologie', 'Hoe heet het groene pigment in bladeren?', 'chlorofyl', 1, null),
('biologie', 'Uit hoeveel kamers bestaat het menselijk hart?', 'vier', 1, null),
('biologie', 'Welke gas ademen we vooral uit?', 'koolstofdioxide', 1, null),
-- Aardrijkskunde
('aardrijkskunde', 'Wat is de hoofdstad van Frankrijk?', 'Parijs', 1, null),
('aardrijkskunde', 'In welk werelddeel ligt Egypte?', 'Afrika', 1, null),
('aardrijkskunde', 'Welke rivier stroomt door Amsterdam?', 'Amstel', 1, null),
('aardrijkskunde', 'Hoeveel provincies heeft Nederland?', '12', 1, null),
('aardrijkskunde', 'Wat is de langste rivier van Europa?', 'Wolga', 1, null),
-- Taal / algemeen
('taal', 'Hoe noem je een zelfstandig naamwoord in het meervoud?', 'meervoud', 1, null),
('algemeen', 'In welk jaar viel de Berlijnse Muur?', '1989', 1, null),
('algemeen', 'Welke planeet staat het dichtst bij de zon?', 'Mercurius', 1, null);
