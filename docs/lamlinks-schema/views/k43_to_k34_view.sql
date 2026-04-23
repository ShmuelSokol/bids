-- dbo.k43_to_k34_view



/* view k43_to_k34_view: add view */


/* view k43_to_k34_view: add view */


/* view k43_to_k34_view: add view */
CREATE VIEW dbo.k43_to_k34_view
AS
SELECT DISTINCT dbo.k43_tab.idnk43_k43, dbo.k34_tab.idnk34_k34
FROM            dbo.k45_tab INNER JOIN
                         dbo.k43_tab ON dbo.k45_tab.idnk43_k45 = dbo.k43_tab.idnk43_k43 INNER JOIN
                         dbo.k37_tab ON dbo.k45_tab.idnk37_k45 = dbo.k37_tab.idnk37_k37 INNER JOIN
                         dbo.k34_tab ON dbo.k37_tab.idnvrq_k37 = dbo.k34_tab.idnk11_k34



