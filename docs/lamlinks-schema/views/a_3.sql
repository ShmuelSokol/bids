-- dbo.a_3



/* view a_3: add view */


/* view a_3: add view */


/* view a_3: add view */

/* view a_3: add view */


/* view a_3: add view */


/* view a_3: add view */
CREATE VIEW [dbo].[a_3]
AS
SELECT        dbo.k13_tab.cage_k13, dbo.k13_tab.c_name_k13, dbo.k08_tab.partno_k08, dbo.k08_tab.p_cage_k08, dbo.k08_tab.p_desc_k08, dbo.k08_tab.niin_k08, dbo.a_2.idnk79_k79, dbo.a_2.idnk80_k80, 
                         dbo.a_2.idnk81_k81, dbo.a_2.idnk71_k71, dbo.k13_tab.idnk13_k13, dbo.a_2.idnk08_k71, dbo.k08_tab.idnk08_k08
FROM            dbo.a_2 INNER JOIN
                         dbo.k13_tab ON dbo.a_2.idnk31_k31 = dbo.k13_tab.idnk13_k13 INNER JOIN
                         dbo.k08_tab ON dbo.a_2.idnk08_k71 = dbo.k08_tab.idnk08_k08






