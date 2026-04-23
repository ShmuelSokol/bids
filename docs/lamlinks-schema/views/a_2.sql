-- dbo.a_2



/* view a_2: add view */


/* view a_2: add view */


/* view a_2: add view */

/* view a_2: add view */


/* view a_2: add view */


/* view a_2: add view */
CREATE VIEW [dbo].[a_2]
AS
SELECT        K71_tab.prtnum_k71, K71_tab.pn_rev_k71, K71_tab.p_desc_k71, K71_tab.idnk71_k71, dbo.a_1.idnk79_k79, dbo.a_1.idnk80_k80, dbo.a_1.idnk81_k81, dbo.a_1.idnk31_k31, dbo.a_1.idnk06_k06, 
                         K71_tab.idnk08_k71
FROM            dbo.k71_tab AS K71_tab INNER JOIN
                         dbo.a_1 ON K71_tab.idnk71_k71 = dbo.a_1.idnk71_k81






