-- dbo.aka_cage_1_view



/* view aka_cage_1_view: add view */


/* view aka_cage_1_view: add view */


/* view aka_cage_1_view: add view */

/* view aka_cage_1_view: add view */


/* view aka_cage_1_view: add view */


/* view aka_cage_1_view: add view */


/* view aka_cage_1_view: add view */
CREATE VIEW [dbo].[aka_cage_1_view]
AS
SELECT        dbo.kap_tab.catitl_kap, dbo.k12_tab.e_code_k12 AS e_code_aka, dbo.k12_tab.e_name_k12 AS e_name_aka, dbo.k12_tab.idnk12_k12 AS idnk12_aka, dbo.k13_tab.idnk13_k13 AS idnk13_aka, 
                         ISNULL(dbo.credential_control_1_view.idnkdg_kdg, 0) AS idnkdg_kdg, ISNULL(dbo.credential_control_1_view.idnkdf_kdf, 0) AS idnkdf_kdf, dbo.credential_control_1_view.c_stat_kdg, 
                         dbo.credential_control_1_view.c_text_kdg, dbo.credential_control_1_view.efftme_kdg
FROM            dbo.k13_tab INNER JOIN
                         dbo.relationship_1_view INNER JOIN
                         dbo.kap_tab ON dbo.relationship_1_view.idnkap_kap = dbo.kap_tab.idnkap_kap ON dbo.k13_tab.idnk13_k13 = dbo.relationship_1_view.idngx1_kau INNER JOIN
                         dbo.k12_tab ON dbo.k13_tab.idnk12_k13 = dbo.k12_tab.idnk12_k12 LEFT OUTER JOIN
                         dbo.credential_control_1_view ON dbo.k12_tab.idnk12_k12 = dbo.credential_control_1_view.idntoa_kdg AND dbo.credential_control_1_view.tbltoa_kdg = 'k12'
WHERE        (dbo.kap_tab.catitl_kap = 'Quote As CAGE')







